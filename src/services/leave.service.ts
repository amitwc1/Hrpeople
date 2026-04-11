import { adminDb } from "@/lib/firebase/admin";
import type {
  LeaveRequest,
  LeaveBalance,
  LeaveStatus,
  LeavePolicy,
  CompanyLeaveType,
  Holiday,
  LeaveAuditLog,
  ApprovalStep,
  ApprovalLevel,
  Employee,
} from "@/types";

const REQUESTS = "leaveRequests";
const BALANCES = "leaveBalances";
const TYPES = "leaveTypes";
const POLICIES = "leavePolicies";
const HOLIDAYS = "holidays";
const AUDIT_LOGS = "leaveAuditLogs";

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

function nowISO(): string {
  return new Date().toISOString();
}

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG ENGINE
// ═══════════════════════════════════════════════════════════════

class AuditEngine {
  static async log(entry: Omit<LeaveAuditLog, "id" | "createdAt">): Promise<void> {
    const docRef = adminDb.collection(AUDIT_LOGS).doc();
    await docRef.set({ ...entry, id: docRef.id, createdAt: nowISO() });
  }

  static async getLogsForRequest(leaveRequestId: string): Promise<LeaveAuditLog[]> {
    const snap = await adminDb
      .collection(AUDIT_LOGS)
      .where("leaveRequestId", "==", leaveRequestId)
      .get();
    const logs = snap.docs.map((d) => d.data() as LeaveAuditLog);
    logs.sort((a: LeaveAuditLog, b: LeaveAuditLog) => a.createdAt.localeCompare(b.createdAt));
    return logs;
  }

  static async getLogsForEmployee(
    companyId: string,
    employeeId: string,
    limit = 50
  ): Promise<LeaveAuditLog[]> {
    const snap = await adminDb
      .collection(AUDIT_LOGS)
      .where("companyId", "==", companyId)
      .where("employeeId", "==", employeeId)
      .limit(limit)
      .get();
    const logs = snap.docs.map((d) => d.data() as LeaveAuditLog);
    logs.sort((a: LeaveAuditLog, b: LeaveAuditLog) => b.createdAt.localeCompare(a.createdAt));
    return logs;
  }
}

// ═══════════════════════════════════════════════════════════════
// APPROVAL WORKFLOW ENGINE
// ═══════════════════════════════════════════════════════════════

class ApprovalEngine {
  /** Build the approval chain for a leave request based on policy levels. */
  static async buildApprovalChain(
    companyId: string,
    employeeId: string,
    totalDays: number,
    approvalLevels: ApprovalLevel[]
  ): Promise<ApprovalStep[]> {
    if (!approvalLevels || approvalLevels.length === 0) {
      // Default: single-level reporting manager approval
      const employee = await this.getEmployee(employeeId);
      if (employee?.managerId) {
        const manager = await this.getEmployee(employee.managerId);
        return [{
          level: 1,
          approverId: employee.managerId,
          approverName: manager ? `${manager.firstName} ${manager.lastName}` : "Manager",
          status: "PENDING",
        }];
      }
      return [];
    }

    const chain: ApprovalStep[] = [];
    const employee = await this.getEmployee(employeeId);

    for (const level of approvalLevels) {
      if (level.requiredAboveDays > 0 && totalDays <= level.requiredAboveDays) continue;

      let approverId = "";
      let approverName = "Unknown";

      switch (level.approverType) {
        case "REPORTING_MANAGER": {
          if (employee?.managerId) {
            approverId = employee.managerId;
            const mgr = await this.getEmployee(employee.managerId);
            approverName = mgr ? `${mgr.firstName} ${mgr.lastName}` : "Manager";
          }
          break;
        }
        case "DEPARTMENT_HEAD": {
          const deptHead = await this.getDepartmentHead(companyId, employee?.department || "");
          if (deptHead) {
            approverId = deptHead.id;
            approverName = `${deptHead.firstName} ${deptHead.lastName}`;
          }
          break;
        }
        case "COMPANY_ADMIN": {
          const admin = await this.getCompanyAdmin(companyId);
          if (admin) {
            approverId = admin.id;
            approverName = `${admin.firstName} ${admin.lastName}`;
          }
          break;
        }
        case "SPECIFIC_USER": {
          if (level.specificUserId) {
            approverId = level.specificUserId;
            const user = await this.getEmployee(level.specificUserId);
            approverName = user ? `${user.firstName} ${user.lastName}` : "Approver";
          }
          break;
        }
      }

      if (approverId) {
        chain.push({ level: level.level, approverId, approverName, status: "PENDING" });
      }
    }

    return chain;
  }

  /** Determine the next status after an approval at a given level. */
  static getNextStatus(chain: ApprovalStep[], currentLevel: number): LeaveStatus {
    const nextPending = chain.find(
      (s) => s.level > currentLevel && s.status === "PENDING"
    );
    if (!nextPending) return "APPROVED";
    if (nextPending.level === 2) return "PENDING_L2";
    if (nextPending.level === 3) return "PENDING_L3";
    return "APPROVED";
  }

  private static async getEmployee(id: string): Promise<Employee | null> {
    const doc = await adminDb.collection("employees").doc(id).get();
    return doc.exists ? (doc.data() as Employee) : null;
  }

  private static async getDepartmentHead(
    companyId: string,
    department: string
  ): Promise<Employee | null> {
    if (!department) return null;
    const snap = await adminDb
      .collection("employees")
      .where("companyId", "==", companyId)
      .where("department", "==", department)
      .where("role", "in", ["MANAGER", "COMPANY_ADMIN"])
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as Employee);
  }

  private static async getCompanyAdmin(companyId: string): Promise<Employee | null> {
    const snap = await adminDb
      .collection("employees")
      .where("companyId", "==", companyId)
      .where("role", "==", "COMPANY_ADMIN")
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as Employee);
  }
}

// ═══════════════════════════════════════════════════════════════
// POLICY VALIDATION ENGINE
// ═══════════════════════════════════════════════════════════════

class PolicyEngine {
  /** Run ALL policy checks before allowing a leave application. */
  static async validate(
    companyId: string,
    employeeId: string,
    leaveType: CompanyLeaveType,
    policy: LeavePolicy,
    data: {
      startDate: string;
      endDate: string;
      isHalfDay: boolean;
      halfDayDate?: string;
      attachmentUrl?: string;
    }
  ): Promise<{ totalDays: number; employee: Employee }> {
    if (data.startDate > data.endDate) throw new Error("End date must be on or after start date");
    if (data.isHalfDay && !policy.allowHalfDay) throw new Error("Half-day is not allowed for this leave type");

    const empDoc = await adminDb.collection("employees").doc(employeeId).get();
    if (!empDoc.exists) throw new Error("Employee record not found");
    const employee = empDoc.data() as Employee;

    // Gender restriction
    if (leaveType.genderRestriction && employee.gender !== leaveType.genderRestriction)
      throw new Error(`This leave type is restricted to ${leaveType.genderRestriction} employees`);

    // Backdated restriction
    const today = todayIST();
    if (data.startDate < today) {
      if (!policy.allowBackdated) throw new Error("Backdated leave is not allowed");
      const daysDiff = Math.floor(
        (new Date(today).getTime() - new Date(data.startDate).getTime()) / 86_400_000
      );
      if (daysDiff > policy.maxBackdatedDays)
        throw new Error(`Cannot apply leave more than ${policy.maxBackdatedDays} days in the past`);
    }

    // Advance notice
    if (policy.advanceNoticeDays > 0 && data.startDate > today) {
      const noticeDays = Math.floor(
        (new Date(data.startDate).getTime() - new Date(today).getTime()) / 86_400_000
      );
      if (noticeDays < policy.advanceNoticeDays)
        throw new Error(`Must apply at least ${policy.advanceNoticeDays} day(s) in advance`);
    }

    // Blackout dates
    if (policy.blackoutDates?.length > 0) {
      const blackoutSet = new Set(policy.blackoutDates);
      const current = new Date(data.startDate);
      const end = new Date(data.endDate);
      while (current <= end) {
        const dateStr = current.toISOString().split("T")[0];
        if (blackoutSet.has(dateStr)) throw new Error(`Leave is blocked on ${dateStr} (blackout date)`);
        current.setDate(current.getDate() + 1);
      }
    }

    // Calculate total days
    const totalDays = await calculateLeaveDays(
      companyId, data.startDate, data.endDate, policy, data.isHalfDay
    );
    if (totalDays <= 0) throw new Error("No working days in the selected range");

    // Min/max per request
    if (totalDays < policy.minDaysPerRequest)
      throw new Error(`Minimum ${policy.minDaysPerRequest} day(s) required`);
    if (totalDays > policy.maxDaysPerRequest)
      throw new Error(`Maximum ${policy.maxDaysPerRequest} day(s) allowed per request`);

    // Probation check
    if (policy.probationRestricted && employee.dateOfJoining) {
      const joinMs = new Date(employee.dateOfJoining).getTime();
      const probationMs = (policy.probationMonths || 6) * 30 * 86_400_000;
      if (Date.now() - joinMs < probationMs) throw new Error("Leave not available during probation period");
    }

    // Attachment requirement
    if (leaveType.requiresAttachment && totalDays > (leaveType.attachmentAfterDays || 0)) {
      if (!data.attachmentUrl)
        throw new Error(`Attachment required for ${leaveType.name} exceeding ${leaveType.attachmentAfterDays} day(s)`);
    }

    // Balance check
    if (leaveType.isPaid && !leaveType.isCompOff) {
      const year = new Date(data.startDate).getFullYear();
      const balance = await LeaveService.getBalance(companyId, employeeId, leaveType.id, year);
      if (balance) {
        if (policy.allowNegativeBalance) {
          const floor = -(policy.maxNegativeBalance || 0);
          if (balance.remaining - totalDays < floor)
            throw new Error(`Insufficient balance. Available: ${balance.remaining}, Max negative: ${policy.maxNegativeBalance}`);
        } else if (balance.remaining < totalDays) {
          throw new Error(`Insufficient balance. Available: ${balance.remaining}, Requested: ${totalDays}`);
        }
      }
    }

    // Department quota check
    if (policy.departmentQuotaPercent > 0 && employee.department) {
      const deptEmps = await adminDb
        .collection("employees")
        .where("companyId", "==", companyId)
        .where("department", "==", employee.department)
        .where("status", "==", "active")
        .get();
      const totalInDept = deptEmps.size;

      const onLeaveSnap = await adminDb
        .collection(REQUESTS)
        .where("companyId", "==", companyId)
        .where("status", "in", ["APPROVED", "PENDING", "PENDING_L2", "PENDING_L3"])
        .get();
      const overlapping = onLeaveSnap.docs.filter((d) => {
        const r = d.data() as LeaveRequest;
        if (r.department !== employee.department) return false;
        if (r.employeeId === employeeId) return false;
        return r.startDate <= data.endDate && r.endDate >= data.startDate;
      }).length;

      const maxAllowed = Math.floor(totalInDept * policy.departmentQuotaPercent / 100);
      if (overlapping >= maxAllowed)
        throw new Error(`Department limit reached: max ${maxAllowed} employees on leave at once (${policy.departmentQuotaPercent}%)`);
    }

    // Overlap check
    const existingSnap = await adminDb
      .collection(REQUESTS)
      .where("companyId", "==", companyId)
      .where("employeeId", "==", employeeId)
      .get();
    const hasOverlap = existingSnap.docs.some((doc) => {
      const existing = doc.data() as LeaveRequest;
      if (existing.status === "REJECTED" || existing.status === "CANCELLED") return false;
      return existing.startDate <= data.endDate && existing.endDate >= data.startDate;
    });
    if (hasOverlap) throw new Error("You already have a leave request overlapping these dates");

    return { totalDays, employee };
  }
}

/** Calculate pro-rata allocation for mid-year joiners. */
function calculateProRataQuota(annualQuota: number, joiningDate: string, year: number): number {
  const joinDate = new Date(joiningDate);
  if (joinDate.getFullYear() < year) return annualQuota;
  if (joinDate.getFullYear() > year) return 0;
  const remainingMonths = 12 - joinDate.getMonth();
  return Math.round((annualQuota * remainingMonths / 12) * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════
// LEAVE CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════

/** Get company working days (defaults 1-5 Mon-Fri) */
async function getWorkingDays(companyId: string): Promise<Set<number>> {
  const compDoc = await adminDb.collection("companies").doc(companyId).get();
  const data = compDoc.data();
  const days = data?.settings?.workingDays ?? [1, 2, 3, 4, 5]; // default Mon-Fri
  return new Set(days as number[]);
}

/** Get holidays for a company in a date range */
async function getHolidaysInRange(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const snap = await adminDb
    .collection(HOLIDAYS)
    .where("companyId", "==", companyId)
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();
  return new Set(snap.docs.map((d) => (d.data() as Holiday).date));
}

/**
 * Calculate actual leave days based on policy.
 * Handles weekends, holidays, half-days, and sandwich rules.
 */
export async function calculateLeaveDays(
  companyId: string,
  startDate: string,
  endDate: string,
  policy: LeavePolicy,
  isHalfDay: boolean
): Promise<number> {
  if (isHalfDay) return 0.5;

  const workingDays = await getWorkingDays(companyId);
  const holidays = await getHolidaysInRange(companyId, startDate, endDate);

  const start = new Date(startDate);
  const end = new Date(endDate);

  let days = 0;
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const dayOfWeek = current.getDay();
    const isWorkingDay = workingDays.has(dayOfWeek);
    const isHoliday = holidays.has(dateStr);

    if (policy.sandwichPolicy) {
      if (policy.includeWeekends || isWorkingDay) {
        if (policy.includeHolidays || !isHoliday) {
          days++;
        }
      }
    } else {
      if (isWorkingDay && !isHoliday) {
        days++;
      }
      if (!isWorkingDay && policy.includeWeekends) {
        days++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return days;
}

// ═══════════════════════════════════════════════════════════════
// LEAVE SERVICE
// ═══════════════════════════════════════════════════════════════

export class LeaveService {
  // ─────────────────────────────────────────────────────────
  // APPLY LEAVE
  // ─────────────────────────────────────────────────────────
  static async applyLeave(
    companyId: string,
    employeeId: string,
    employeeName: string,
    data: {
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      reason: string;
      isHalfDay?: boolean;
      halfDayDate?: string;
      attachmentUrl?: string;
      compOffDate?: string;
    }
  ): Promise<LeaveRequest> {
    console.log(`[LeaveService] applyLeave — employee: ${employeeId}, type: ${data.leaveTypeId}, ${data.startDate} to ${data.endDate}`);

    // Get leave type
    const typeDoc = await adminDb.collection(TYPES).doc(data.leaveTypeId).get();
    if (!typeDoc.exists) throw new Error("Leave type not found");
    const leaveType = typeDoc.data() as CompanyLeaveType;
    if (leaveType.companyId !== companyId || !leaveType.isActive)
      throw new Error("Leave type not available");

    // Get policy
    const policy = await this.getPolicyForType(companyId, data.leaveTypeId);
    if (!policy) throw new Error("No leave policy configured for this leave type");

    // Run policy validation engine (all checks)
    const { totalDays, employee } = await PolicyEngine.validate(
      companyId, employeeId, leaveType, policy,
      {
        startDate: data.startDate,
        endDate: data.endDate,
        isHalfDay: data.isHalfDay ?? false,
        halfDayDate: data.halfDayDate,
        attachmentUrl: data.attachmentUrl,
      }
    );

    // Build approval chain
    const approvalChain = await ApprovalEngine.buildApprovalChain(
      companyId, employeeId, totalDays, policy.approvalLevels || []
    );
    const initialStatus: LeaveStatus = approvalChain.length === 0 ? "APPROVED" : "PENDING";

    // Create request
    const docRef = adminDb.collection(REQUESTS).doc();
    const now = nowISO();
    const request: LeaveRequest = stripUndefined({
      id: docRef.id,
      companyId,
      employeeId,
      employeeName,
      department: employee.department || "",
      leaveTypeId: data.leaveTypeId,
      leaveTypeName: leaveType.name,
      startDate: data.startDate,
      endDate: data.endDate,
      isHalfDay: data.isHalfDay ?? false,
      halfDayDate: data.isHalfDay ? data.halfDayDate : undefined,
      totalDays,
      reason: data.reason,
      attachmentUrl: data.attachmentUrl,
      status: initialStatus,
      currentApprovalLevel: approvalChain.length > 0 ? 1 : 0,
      approvalChain,
      isCompOff: leaveType.isCompOff || false,
      compOffDate: leaveType.isCompOff ? data.compOffDate : undefined,
      approvedBy: initialStatus === "APPROVED" ? "AUTO" : undefined,
      approvedByName: initialStatus === "APPROVED" ? "Auto-approved (no approval chain)" : undefined,
      approvedAt: initialStatus === "APPROVED" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });

    await docRef.set(request);
    console.log(`[LeaveService] Leave request created: ${docRef.id}, totalDays: ${totalDays}, status: ${initialStatus}`);

    // Audit log
    await AuditEngine.log({
      companyId, leaveRequestId: docRef.id, employeeId,
      action: "APPLIED",
      performedBy: employeeId, performedByName: employeeName,
      details: { totalDays, startDate: data.startDate, endDate: data.endDate, leaveType: leaveType.name },
      newStatus: initialStatus,
    });

    // If auto-approved (no chain), deduct balance and sync attendance
    if (initialStatus === "APPROVED") {
      await this.deductBalanceAfterApproval(request);
      await this.markAttendanceOnLeave(request);
    }

    return request;
  }

  // ─────────────────────────────────────────────────────────
  // APPROVE LEAVE (multi-level)
  // ─────────────────────────────────────────────────────────
  static async approveLeave(
    companyId: string,
    leaveId: string,
    approverId: string,
    approverName: string,
    comment?: string,
    forceOverride?: boolean
  ): Promise<LeaveRequest> {
    const docRef = adminDb.collection(REQUESTS).doc(leaveId);

    // Pre-check: attendance conflicts
    const preDoc = await docRef.get();
    if (!preDoc.exists) throw new Error("Leave request not found");
    const preLeave = preDoc.data() as LeaveRequest;

    if (!forceOverride) {
      const { AttendanceService } = await import("@/services/attendance.service");
      const { conflicts } = await AttendanceService.validateAttendanceBeforeLeave(
        companyId, preLeave.employeeId, preLeave.startDate, preLeave.endDate
      );
      if (conflicts.length > 0) {
        const dates = conflicts.map((c) => c.date).join(", ");
        throw new Error(
          `Attendance conflict: employee was marked PRESENT on ${dates}. Use forceOverride to approve and overwrite attendance.`
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await adminDb.runTransaction(async (txn: any) => {
      const doc = await txn.get(docRef);
      if (!doc.exists) throw new Error("Leave request not found");

      const leave = doc.data() as LeaveRequest;
      if (leave.companyId !== companyId) throw new Error("Access denied");

      const pendingStatuses: LeaveStatus[] = ["PENDING", "PENDING_L2", "PENDING_L3"];
      if (!pendingStatuses.includes(leave.status))
        throw new Error("Only pending requests can be approved");

      const now = nowISO();
      const chain = [...(leave.approvalChain || [])];

      // Find the current pending step in the chain
      const currentStep = chain.find(
        (s) => s.level === leave.currentApprovalLevel && s.status === "PENDING"
      );

      if (currentStep) {
        // Verify the approver is authorized for this level (or is an admin)
        const approverEmp = await adminDb.collection("employees").doc(approverId).get();
        const isAdminRole = approverEmp.exists &&
          ["COMPANY_ADMIN", "SUPER_ADMIN"].includes(approverEmp.data()?.role);

        if (currentStep.approverId !== approverId && !isAdminRole)
          throw new Error(`You are not the designated approver for level ${leave.currentApprovalLevel}`);

        currentStep.status = "APPROVED";
        currentStep.comment = comment;
        currentStep.actionAt = now;
        currentStep.approverId = approverId;
        currentStep.approverName = approverName;
      }

      const nextStatus = chain.length > 0
        ? ApprovalEngine.getNextStatus(chain, leave.currentApprovalLevel)
        : "APPROVED";

      const nextLevel = chain.find(
        (s) => s.level > leave.currentApprovalLevel && s.status === "PENDING"
      );

      const isFullyApproved = nextStatus === "APPROVED";
      const updates: Partial<LeaveRequest> = {
        status: nextStatus,
        currentApprovalLevel: nextLevel ? nextLevel.level : leave.currentApprovalLevel,
        approvalChain: chain,
        updatedAt: now,
      };

      if (isFullyApproved) {
        updates.approvedBy = approverId;
        updates.approvedByName = approverName;
        updates.approvedAt = now;
        updates.approverComment = comment;
      }

      txn.update(docRef, stripUndefined(updates));

      // Deduct balance only on final approval
      if (isFullyApproved) {
        const typeDoc = await txn.get(adminDb.collection(TYPES).doc(leave.leaveTypeId));
        if (typeDoc.exists) {
          const lt = typeDoc.data() as CompanyLeaveType;
          if (lt.isPaid) {
            const startYear = new Date(leave.startDate).getFullYear();
            const endYear = new Date(leave.endDate).getFullYear();

            if (startYear === endYear) {
              await this.deductBalanceInTxn(txn, leave.employeeId, leave.leaveTypeId, startYear, leave.totalDays, leave.companyId);
            } else {
              // Cross-year: split days
              const yearEnd = `${startYear}-12-31`;
              const policy = await LeaveService.getPolicyForType(companyId, leave.leaveTypeId);
              const daysInYear1 = policy
                ? await calculateLeaveDays(companyId, leave.startDate, yearEnd, policy, false)
                : leave.totalDays;
              const daysInYear2 = leave.totalDays - daysInYear1;

              if (daysInYear1 > 0) await this.deductBalanceInTxn(txn, leave.employeeId, leave.leaveTypeId, startYear, daysInYear1, companyId);
              if (daysInYear2 > 0) await this.deductBalanceInTxn(txn, leave.employeeId, leave.leaveTypeId, endYear, daysInYear2, companyId);
            }
          }
        }
      }

      return { ...leave, ...updates } as LeaveRequest;
    });

    const isFullyApproved = result.status === "APPROVED";

    await AuditEngine.log({
      companyId, leaveRequestId: leaveId, employeeId: result.employeeId,
      action: isFullyApproved ? "APPROVED" : "ESCALATED",
      performedBy: approverId, performedByName: approverName,
      details: { level: preLeave.currentApprovalLevel, comment, newStatus: result.status, forceOverride: forceOverride || false },
      previousStatus: preLeave.status, newStatus: result.status,
    });

    if (isFullyApproved) {
      console.log(`[LeaveService] Fully approved leave ${leaveId}, syncing attendance...`);
      await this.markAttendanceOnLeave(result);
      await AuditEngine.log({
        companyId, leaveRequestId: leaveId, employeeId: result.employeeId,
        action: "ATTENDANCE_SYNCED",
        performedBy: "system", performedByName: "System",
        details: { startDate: result.startDate, endDate: result.endDate },
      });
    }

    return result;
  }

  private static async deductBalanceInTxn(
    txn: FirebaseFirestore.Transaction,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
    companyId: string
  ): Promise<void> {
    const balId = `${employeeId}_${leaveTypeId}_${year}`;
    const balRef = adminDb.collection(BALANCES).doc(balId);
    const balDoc = await txn.get(balRef);

    if (balDoc.exists) {
      const bal = balDoc.data() as LeaveBalance;
      txn.update(balRef, {
        used: bal.used + days,
        remaining: bal.remaining - days,
        updatedAt: nowISO(),
      });
    } else {
      txn.set(balRef, {
        id: balId, companyId, employeeId, leaveTypeId, leaveTypeName: "", year,
        totalAllocated: 0, used: days, remaining: -days,
        carryForward: 0, encashed: 0, updatedAt: nowISO(),
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // REJECT LEAVE
  // ─────────────────────────────────────────────────────────
  static async rejectLeave(
    companyId: string,
    leaveId: string,
    rejectedBy: string,
    rejectedByName: string,
    comment?: string
  ): Promise<LeaveRequest> {
    const docRef = adminDb.collection(REQUESTS).doc(leaveId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Leave request not found");

    const leave = doc.data() as LeaveRequest;
    if (leave.companyId !== companyId) throw new Error("Access denied");

    const pendingStatuses: LeaveStatus[] = ["PENDING", "PENDING_L2", "PENDING_L3"];
    if (!pendingStatuses.includes(leave.status))
      throw new Error("Only pending requests can be rejected");

    const now = nowISO();
    const chain = [...(leave.approvalChain || [])];
    const currentStep = chain.find(
      (s) => s.level === leave.currentApprovalLevel && s.status === "PENDING"
    );
    if (currentStep) {
      currentStep.status = "REJECTED";
      currentStep.comment = comment;
      currentStep.actionAt = now;
      currentStep.approverId = rejectedBy;
      currentStep.approverName = rejectedByName;
    }

    const updates: Partial<LeaveRequest> = {
      status: "REJECTED",
      rejectedBy,
      rejectedByName,
      rejectedAt: now,
      approverComment: comment,
      approvalChain: chain,
      updatedAt: now,
    };

    await docRef.update(stripUndefined(updates));

    await AuditEngine.log({
      companyId, leaveRequestId: leaveId, employeeId: leave.employeeId,
      action: "REJECTED",
      performedBy: rejectedBy, performedByName: rejectedByName,
      details: { comment, level: leave.currentApprovalLevel },
      previousStatus: leave.status, newStatus: "REJECTED",
    });

    return { ...leave, ...updates } as LeaveRequest;
  }

  // ─────────────────────────────────────────────────────────
  // CANCEL LEAVE
  // ─────────────────────────────────────────────────────────
  static async cancelLeave(
    companyId: string,
    leaveId: string,
    employeeId: string,
    isAdmin: boolean
  ): Promise<LeaveRequest> {
    const docRef = adminDb.collection(REQUESTS).doc(leaveId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await adminDb.runTransaction(async (txn: any) => {
      const doc = await txn.get(docRef);
      if (!doc.exists) throw new Error("Leave request not found");

      const leave = doc.data() as LeaveRequest;
      if (leave.companyId !== companyId) throw new Error("Access denied");
      if (!isAdmin && leave.employeeId !== employeeId)
        throw new Error("You can only cancel your own requests");

      const pendingStatuses: LeaveStatus[] = ["PENDING", "PENDING_L2", "PENDING_L3"];
      const wasPending = pendingStatuses.includes(leave.status);
      const wasApproved = leave.status === "APPROVED";

      if (!wasPending && !wasApproved)
        throw new Error("Only pending or approved requests can be cancelled");
      if (!isAdmin && !wasPending)
        throw new Error("Only pending requests can be cancelled by employees");

      const now = nowISO();
      txn.update(docRef, {
        status: "CANCELLED" as LeaveStatus,
        cancelledAt: now,
        cancelledBy: employeeId,
        updatedAt: now,
      });

      // Restore balance if it was approved
      if (wasApproved) {
        const typeDoc = await txn.get(adminDb.collection(TYPES).doc(leave.leaveTypeId));
        if (typeDoc.exists && (typeDoc.data() as CompanyLeaveType).isPaid) {
          const startYear = new Date(leave.startDate).getFullYear();
          const endYear = new Date(leave.endDate).getFullYear();

          if (startYear === endYear) {
            const balId = `${leave.employeeId}_${leave.leaveTypeId}_${startYear}`;
            const balRef = adminDb.collection(BALANCES).doc(balId);
            const balDoc = await txn.get(balRef);
            if (balDoc.exists) {
              const bal = balDoc.data() as LeaveBalance;
              txn.update(balRef, {
                used: Math.max(0, bal.used - leave.totalDays),
                remaining: bal.remaining + leave.totalDays,
                updatedAt: now,
              });
            }
          } else {
            // Cross-year restore
            const yearEnd = `${startYear}-12-31`;
            const policy = await LeaveService.getPolicyForType(companyId, leave.leaveTypeId);
            const daysInYear1 = policy
              ? await calculateLeaveDays(companyId, leave.startDate, yearEnd, policy, false)
              : leave.totalDays;
            const daysInYear2 = leave.totalDays - daysInYear1;

            for (const [yr, days] of [[startYear, daysInYear1], [endYear, daysInYear2]] as [number, number][]) {
              if (days > 0) {
                const balId = `${leave.employeeId}_${leave.leaveTypeId}_${yr}`;
                const balRef = adminDb.collection(BALANCES).doc(balId);
                const balDoc = await txn.get(balRef);
                if (balDoc.exists) {
                  const bal = balDoc.data() as LeaveBalance;
                  txn.update(balRef, {
                    used: Math.max(0, bal.used - days),
                    remaining: bal.remaining + days,
                    updatedAt: now,
                  });
                }
              }
            }
          }
        }
      }

      return { ...leave, status: "CANCELLED" as LeaveStatus, cancelledAt: now, cancelledBy: employeeId, _wasApproved: wasApproved } as LeaveRequest & { _wasApproved: boolean };
    });

    if ((result as LeaveRequest & { _wasApproved?: boolean })._wasApproved) {
      console.log(`[LeaveService] Cancelled approved leave ${leaveId}, reverting attendance...`);
      await this.removeAttendanceOnLeave(result);
    }

    await AuditEngine.log({
      companyId, leaveRequestId: leaveId, employeeId: result.employeeId,
      action: "CANCELLED",
      performedBy: employeeId, performedByName: result.employeeName,
      details: {
        wasApproved: (result as LeaveRequest & { _wasApproved?: boolean })._wasApproved,
        totalDaysRestored: (result as LeaveRequest & { _wasApproved?: boolean })._wasApproved ? result.totalDays : 0,
      },
      previousStatus: (result as LeaveRequest & { _wasApproved?: boolean })._wasApproved ? "APPROVED" : "PENDING",
      newStatus: "CANCELLED",
    });

    return result;
  }

  // ─────────────────────────────────────────────────────────
  // LIST REQUESTS (enhanced: date range, department, pending-for-manager)
  // ─────────────────────────────────────────────────────────
  static async listRequests(
    companyId: string,
    filters: {
      employeeId?: string;
      status?: LeaveStatus;
      managerId?: string;
      department?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ requests: LeaveRequest[]; total: number }> {
    const { employeeId, status, page = 1, pageSize = 20 } = filters;

    let query: FirebaseFirestore.Query = adminDb
      .collection(REQUESTS)
      .where("companyId", "==", companyId);

    if (employeeId) query = query.where("employeeId", "==", employeeId);
    if (status) query = query.where("status", "==", status);

    const snapshot = await query.get();
    let allRequests = snapshot.docs.map((d) => d.data() as LeaveRequest);
    allRequests.sort((a: LeaveRequest, b: LeaveRequest) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    if (filters.startDate) allRequests = allRequests.filter((r) => r.endDate >= filters.startDate!);
    if (filters.endDate) allRequests = allRequests.filter((r) => r.startDate <= filters.endDate!);
    if (filters.department) allRequests = allRequests.filter((r) => r.department === filters.department);

    // Filter to manager's direct reports + leaves pending this manager's approval
    if (filters.managerId) {
      const empSnap = await adminDb
        .collection("employees")
        .where("companyId", "==", companyId)
        .where("managerId", "==", filters.managerId)
        .get();
      const reportIds = new Set(empSnap.docs.map((d) => d.id));
      allRequests = allRequests.filter((r) =>
        reportIds.has(r.employeeId) ||
        r.approvalChain?.some(
          (s) => s.approverId === filters.managerId && s.status === "PENDING"
        )
      );
    }

    const total = allRequests.length;
    const offset = (page - 1) * pageSize;
    return { requests: allRequests.slice(offset, offset + pageSize), total };
  }

  // ─────────────────────────────────────────────────────────
  // TEAM CALENDAR (leaves for a department/month)
  // ─────────────────────────────────────────────────────────
  static async getTeamCalendar(
    companyId: string,
    year: number,
    month: number,
    department?: string
  ): Promise<{ date: string; employeeId: string; employeeName: string; leaveTypeName: string; isHalfDay: boolean; status: LeaveStatus }[]> {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

    const snap = await adminDb
      .collection(REQUESTS)
      .where("companyId", "==", companyId)
      .where("status", "in", ["APPROVED", "PENDING", "PENDING_L2", "PENDING_L3"])
      .get();

    const entries: { date: string; employeeId: string; employeeName: string; leaveTypeName: string; isHalfDay: boolean; status: LeaveStatus }[] = [];

    for (const doc of snap.docs) {
      const r = doc.data() as LeaveRequest;
      if (r.startDate > endDate || r.endDate < startDate) continue;
      if (department && r.department !== department) continue;

      const current = new Date(Math.max(new Date(r.startDate).getTime(), new Date(startDate).getTime()));
      const end = new Date(Math.min(new Date(r.endDate).getTime(), new Date(endDate).getTime()));

      while (current <= end) {
        const dateStr = current.toISOString().split("T")[0];
        entries.push({
          date: dateStr,
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          leaveTypeName: r.leaveTypeName,
          isHalfDay: r.isHalfDay && r.halfDayDate === dateStr,
          status: r.status,
        });
        current.setDate(current.getDate() + 1);
      }
    }

    entries.sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
    return entries;
  }

  // ─────────────────────────────────────────────────────────
  // BALANCE OPERATIONS
  // ─────────────────────────────────────────────────────────
  static async getBalance(
    companyId: string,
    employeeId: string,
    leaveTypeId: string,
    year: number
  ): Promise<LeaveBalance | null> {
    const docId = `${employeeId}_${leaveTypeId}_${year}`;
    const doc = await adminDb.collection(BALANCES).doc(docId).get();
    if (!doc.exists) return null;
    const bal = doc.data() as LeaveBalance;
    if (bal.companyId !== companyId) return null;
    return bal;
  }

  /** Get ALL balances for an employee for a given year */
  static async getAllBalances(
    companyId: string,
    employeeId: string,
    year: number
  ): Promise<LeaveBalance[]> {
    const snap = await adminDb
      .collection(BALANCES)
      .where("companyId", "==", companyId)
      .where("employeeId", "==", employeeId)
      .where("year", "==", year)
      .get();
    return snap.docs.map((d) => d.data() as LeaveBalance);
  }

  /** Initialize balances for a new employee (with pro-rata support) */
  static async initializeBalances(
    companyId: string,
    employeeId: string,
    year: number,
    joiningDate?: string
  ): Promise<void> {
    const policies = await this.getActivePolicies(companyId);
    const batch = adminDb.batch();
    const now = nowISO();

    for (const policy of policies) {
      const typeDoc = await adminDb.collection(TYPES).doc(policy.leaveTypeId).get();
      if (!typeDoc.exists) continue;
      const lt = typeDoc.data() as CompanyLeaveType;

      let quota = policy.annualQuota;
      if (policy.proRataForNewJoiners && joiningDate) {
        quota = calculateProRataQuota(policy.annualQuota, joiningDate, year);
      }

      const docId = `${employeeId}_${policy.leaveTypeId}_${year}`;
      const docRef = adminDb.collection(BALANCES).doc(docId);
      const bal: LeaveBalance = {
        id: docId,
        companyId,
        employeeId,
        leaveTypeId: policy.leaveTypeId,
        leaveTypeName: lt.name,
        year,
        totalAllocated: quota,
        used: 0,
        remaining: quota,
        carryForward: 0,
        encashed: 0,
        updatedAt: now,
      };
      batch.set(docRef, bal);
    }

    await batch.commit();
  }

  /** Year-end carry forward: calculate carry and reset for new year */
  static async processCarryForward(companyId: string, fromYear: number): Promise<number> {
    const toYear = fromYear + 1;
    const policies = await this.getActivePolicies(companyId);
    let count = 0;

    // Get all employees
    const empSnap = await adminDb
      .collection("employees")
      .where("companyId", "==", companyId)
      .where("status", "==", "active")
      .get();

    const batch = adminDb.batch();

    for (const empDoc of empSnap.docs) {
      const employeeId = empDoc.id;

      for (const policy of policies) {
        const typeDoc = await adminDb.collection(TYPES).doc(policy.leaveTypeId).get();
        if (!typeDoc.exists) continue;
        const lt = typeDoc.data() as CompanyLeaveType;

        // Get old balance
        const oldBalId = `${employeeId}_${policy.leaveTypeId}_${fromYear}`;
        const oldBalDoc = await adminDb.collection(BALANCES).doc(oldBalId).get();
        let carryDays = 0;

        if (oldBalDoc.exists && policy.carryForward) {
          const oldBal = oldBalDoc.data() as LeaveBalance;
          carryDays = Math.min(oldBal.remaining, policy.maxCarryForwardDays);
        }

        // Create new year balance
        const newBalId = `${employeeId}_${policy.leaveTypeId}_${toYear}`;
        const newBal: LeaveBalance = {
          id: newBalId,
          companyId,
          employeeId,
          leaveTypeId: policy.leaveTypeId,
          leaveTypeName: lt.name,
          year: toYear,
          totalAllocated: policy.annualQuota + carryDays,
          used: 0,
          remaining: policy.annualQuota + carryDays,
          carryForward: carryDays,
          encashed: 0,
          updatedAt: nowISO(),
        };
        batch.set(adminDb.collection(BALANCES).doc(newBalId), newBal);
        count++;
      }
    }

    await batch.commit();
    return count;
  }

  /** Monthly accrual: add prorated quota to balances */
  static async processMonthlyAccrual(companyId: string, year: number): Promise<number> {
    const policies = (await this.getActivePolicies(companyId)).filter(
      (p) => p.monthlyAccrual
    );
    if (policies.length === 0) return 0;

    const empSnap = await adminDb
      .collection("employees")
      .where("companyId", "==", companyId)
      .where("status", "==", "active")
      .get();

    const batch = adminDb.batch();
    let count = 0;
    const now = nowISO();

    for (const empDoc of empSnap.docs) {
      for (const policy of policies) {
        const monthlyAmount = Math.round((policy.annualQuota / 12) * 100) / 100;
        const balId = `${empDoc.id}_${policy.leaveTypeId}_${year}`;
        const balRef = adminDb.collection(BALANCES).doc(balId);
        const balDoc = await balRef.get();

        if (balDoc.exists) {
          const bal = balDoc.data() as LeaveBalance;
          batch.update(balRef, {
            totalAllocated: bal.totalAllocated + monthlyAmount,
            remaining: bal.remaining + monthlyAmount,
            updatedAt: now,
          });
          count++;
        }
      }
    }

    await batch.commit();
    return count;
  }

  // ─────────────────────────────────────────────────────────
  // LEAVE ENCASHMENT
  // ─────────────────────────────────────────────────────────
  static async encashLeave(
    companyId: string,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
    performedBy: string,
    performedByName: string
  ): Promise<LeaveBalance> {
    const policy = await this.getPolicyForType(companyId, leaveTypeId);
    if (!policy?.allowEncashment) throw new Error("Encashment not allowed for this leave type");
    if (days > (policy.maxEncashmentDays || 0))
      throw new Error(`Maximum ${policy.maxEncashmentDays} days can be encashed`);

    const balId = `${employeeId}_${leaveTypeId}_${year}`;
    const balRef = adminDb.collection(BALANCES).doc(balId);
    const balDoc = await balRef.get();
    if (!balDoc.exists) throw new Error("No balance found for this year");

    const bal = balDoc.data() as LeaveBalance;
    if (bal.companyId !== companyId) throw new Error("Access denied");
    if (bal.remaining < days) throw new Error(`Insufficient balance to encash ${days} days`);

    const now = nowISO();
    await balRef.update({
      remaining: bal.remaining - days,
      encashed: (bal.encashed || 0) + days,
      updatedAt: now,
    });

    await AuditEngine.log({
      companyId, leaveRequestId: "", employeeId,
      action: "ENCASHED",
      performedBy, performedByName,
      details: { leaveTypeId, year, days, previousRemaining: bal.remaining },
    });

    return { ...bal, remaining: bal.remaining - days, encashed: (bal.encashed || 0) + days, updatedAt: now };
  }

  // ─────────────────────────────────────────────────────────
  // AUDIT LOGS
  // ─────────────────────────────────────────────────────────
  static async getAuditLogs(leaveRequestId: string): Promise<LeaveAuditLog[]> {
    return AuditEngine.getLogsForRequest(leaveRequestId);
  }

  static async getEmployeeAuditLogs(
    companyId: string,
    employeeId: string,
    limit = 50
  ): Promise<LeaveAuditLog[]> {
    return AuditEngine.getLogsForEmployee(companyId, employeeId, limit);
  }

  // ─────────────────────────────────────────────────────────
  // LEAVE TYPES (CRUD)
  // ─────────────────────────────────────────────────────────
  static async createLeaveType(
    companyId: string,
    data: Omit<CompanyLeaveType, "id" | "companyId" | "createdAt" | "updatedAt">
  ): Promise<CompanyLeaveType> {
    // Check for duplicate code
    const existing = await adminDb
      .collection(TYPES)
      .where("companyId", "==", companyId)
      .where("code", "==", data.code)
      .get();
    if (!existing.empty) throw new Error(`Leave type with code "${data.code}" already exists`);

    const docRef = adminDb.collection(TYPES).doc();
    const now = nowISO();
    const lt: CompanyLeaveType = {
      id: docRef.id,
      companyId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(lt);
    return lt;
  }

  static async getLeaveTypes(companyId: string): Promise<CompanyLeaveType[]> {
    const snap = await adminDb
      .collection(TYPES)
      .where("companyId", "==", companyId)
      .get();
    return snap.docs.map((d) => d.data() as CompanyLeaveType);
  }

  static async updateLeaveType(
    companyId: string,
    typeId: string,
    data: Partial<CompanyLeaveType>
  ): Promise<CompanyLeaveType> {
    const docRef = adminDb.collection(TYPES).doc(typeId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Leave type not found");
    const existing = doc.data() as CompanyLeaveType;
    if (existing.companyId !== companyId) throw new Error("Access denied");

    const updates = { ...data, updatedAt: nowISO() };
    await docRef.update(stripUndefined(updates));
    return { ...existing, ...updates } as CompanyLeaveType;
  }

  static async deleteLeaveType(companyId: string, typeId: string): Promise<void> {
    const docRef = adminDb.collection(TYPES).doc(typeId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Leave type not found");
    if ((doc.data() as CompanyLeaveType).companyId !== companyId)
      throw new Error("Access denied");
    await docRef.delete();
  }

  // ─────────────────────────────────────────────────────────
  // LEAVE POLICIES (CRUD)
  // ─────────────────────────────────────────────────────────
  static async createPolicy(
    companyId: string,
    data: Omit<LeavePolicy, "id" | "companyId" | "createdAt" | "updatedAt">
  ): Promise<LeavePolicy> {
    // Verify leave type exists
    const typeDoc = await adminDb.collection(TYPES).doc(data.leaveTypeId).get();
    if (!typeDoc.exists) throw new Error("Leave type not found");

    const docRef = adminDb.collection(POLICIES).doc();
    const now = nowISO();
    const policy: LeavePolicy = {
      id: docRef.id,
      companyId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(policy);
    return policy;
  }

  static async getPolicies(companyId: string): Promise<LeavePolicy[]> {
    const snap = await adminDb
      .collection(POLICIES)
      .where("companyId", "==", companyId)
      .get();
    return snap.docs.map((d) => d.data() as LeavePolicy);
  }

  static async updatePolicy(
    companyId: string,
    policyId: string,
    data: Partial<LeavePolicy>
  ): Promise<LeavePolicy> {
    const docRef = adminDb.collection(POLICIES).doc(policyId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Leave policy not found");
    const existing = doc.data() as LeavePolicy;
    if (existing.companyId !== companyId) throw new Error("Access denied");

    const updates = { ...data, updatedAt: nowISO() };
    await docRef.update(stripUndefined(updates));
    return { ...existing, ...updates } as LeavePolicy;
  }

  static async deletePolicy(companyId: string, policyId: string): Promise<void> {
    const docRef = adminDb.collection(POLICIES).doc(policyId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Leave policy not found");
    if ((doc.data() as LeavePolicy).companyId !== companyId)
      throw new Error("Access denied");
    await docRef.delete();
  }

  // ─────────────────────────────────────────────────────────
  // HOLIDAYS (CRUD)
  // ─────────────────────────────────────────────────────────
  static async createHoliday(
    companyId: string,
    data: { name: string; date: string; isOptional?: boolean; isRestrictedHoliday?: boolean }
  ): Promise<Holiday> {
    const docRef = adminDb.collection(HOLIDAYS).doc();
    const now = nowISO();
    const holiday: Holiday = {
      id: docRef.id,
      companyId,
      name: data.name,
      date: data.date,
      isOptional: data.isOptional ?? false,
      isRestrictedHoliday: data.isRestrictedHoliday ?? false,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(holiday);
    return holiday;
  }

  static async getHolidays(companyId: string, year?: number): Promise<Holiday[]> {
    let query: FirebaseFirestore.Query = adminDb
      .collection(HOLIDAYS)
      .where("companyId", "==", companyId);

    if (year) {
      query = query
        .where("date", ">=", `${year}-01-01`)
        .where("date", "<=", `${year}-12-31`);
    }

    const snap = await query.get();
    const holidays = snap.docs.map((d) => d.data() as Holiday);
    holidays.sort((a: Holiday, b: Holiday) => a.date.localeCompare(b.date));
    return holidays;
  }

  static async updateHoliday(
    companyId: string,
    holidayId: string,
    data: Partial<Holiday>
  ): Promise<Holiday> {
    const docRef = adminDb.collection(HOLIDAYS).doc(holidayId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Holiday not found");
    const existing = doc.data() as Holiday;
    if (existing.companyId !== companyId) throw new Error("Access denied");

    const updates = { ...data, updatedAt: nowISO() };
    await docRef.update(stripUndefined(updates));
    return { ...existing, ...updates } as Holiday;
  }

  static async deleteHoliday(companyId: string, holidayId: string): Promise<void> {
    const docRef = adminDb.collection(HOLIDAYS).doc(holidayId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Holiday not found");
    if ((doc.data() as Holiday).companyId !== companyId)
      throw new Error("Access denied");
    await docRef.delete();
  }

  // ─────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────
  static async getPendingCount(companyId: string): Promise<number> {
    const snap = await adminDb
      .collection(REQUESTS)
      .where("companyId", "==", companyId)
      .where("status", "in", ["PENDING", "PENDING_L2", "PENDING_L3"])
      .count()
      .get();
    return snap.data().count;
  }

  // ─────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────

  /** Deduct balance after auto-approval (no chain) */
  private static async deductBalanceAfterApproval(leave: LeaveRequest): Promise<void> {
    const typeDoc = await adminDb.collection(TYPES).doc(leave.leaveTypeId).get();
    if (!typeDoc.exists) return;
    const lt = typeDoc.data() as CompanyLeaveType;
    if (!lt.isPaid) return;

    const year = new Date(leave.startDate).getFullYear();
    const balId = `${leave.employeeId}_${leave.leaveTypeId}_${year}`;
    const balRef = adminDb.collection(BALANCES).doc(balId);
    const balDoc = await balRef.get();

    if (balDoc.exists) {
      const bal = balDoc.data() as LeaveBalance;
      await balRef.update({
        used: bal.used + leave.totalDays,
        remaining: bal.remaining - leave.totalDays,
        updatedAt: nowISO(),
      });
    }
  }

  private static async getPolicyForType(
    companyId: string,
    leaveTypeId: string
  ): Promise<LeavePolicy | null> {
    const snap = await adminDb
      .collection(POLICIES)
      .where("companyId", "==", companyId)
      .where("leaveTypeId", "==", leaveTypeId)
      .where("isActive", "==", true)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as LeavePolicy;
  }

  private static async getActivePolicies(companyId: string): Promise<LeavePolicy[]> {
    const snap = await adminDb
      .collection(POLICIES)
      .where("companyId", "==", companyId)
      .where("isActive", "==", true)
      .get();
    return snap.docs.map((d) => d.data() as LeavePolicy);
  }

  /** Mark each date of an approved leave as ON_LEAVE in attendance */
  private static async markAttendanceOnLeave(leave: LeaveRequest): Promise<void> {
    const { AttendanceService } = await import("@/services/attendance.service");
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      const isHalfDay = leave.isHalfDay && leave.halfDayDate === dateStr;
      try {
        await AttendanceService.markOnLeave(
          leave.companyId,
          leave.employeeId,
          leave.employeeName,
          dateStr,
          {
            leaveTypeId: leave.leaveTypeId,
            leaveTypeName: leave.leaveTypeName,
            leaveRequestId: leave.id,
            isHalfDay,
          }
        );
      } catch {
        // Best-effort: don't fail the approval if attendance marking fails
      }
      current.setDate(current.getDate() + 1);
    }
  }

  /** Remove ON_LEAVE from attendance when leave is cancelled */
  private static async removeAttendanceOnLeave(leave: LeaveRequest): Promise<void> {
    const { AttendanceService } = await import("@/services/attendance.service");
    try {
      await AttendanceService.removeLeaveFromAttendance(leave);
    } catch {
      // Best-effort
    }
  }
}

