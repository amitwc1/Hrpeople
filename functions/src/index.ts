/**
 * HR People — Firebase Cloud Functions
 *
 * Event-driven triggers and background jobs for:
 * - Leave ↔ Attendance sync (approval / cancellation)
 * - Daily attendance cron (absent / on-leave / holiday)
 * - Leave request notifications
 * - Attendance monitoring
 * - Monthly payroll processing
 * - Employee onboarding
 * - Custom claims sync
 */

import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

// ─── Helpers ──────────────────────────────────────────────────

function makeDocId(employeeId: string, date: string): string {
  return `${employeeId}_${date}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function getTodayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// ─────────────────────────────────────────────────────────────
// 1. LEAVE REQUEST CREATED — Notify managers
// ─────────────────────────────────────────────────────────────
export const onLeaveRequestCreated = onDocumentCreated(
  "leaveRequests/{leaveId}",
  async (event) => {
    const leave = event.data?.data();
    if (!leave) return;

    const { companyId, employeeName, leaveTypeName, startDate, endDate, totalDays } = leave;

    const managersSnap = await db
      .collection("users")
      .where("companyId", "==", companyId)
      .where("role", "in", ["COMPANY_ADMIN", "MANAGER"])
      .get();

    const batch = db.batch();
    managersSnap.docs.forEach((managerDoc) => {
      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        id: notifRef.id,
        companyId,
        userId: managerDoc.id,
        title: "New Leave Request",
        message: `${employeeName} has requested ${totalDays} day(s) of ${leaveTypeName || "leave"} from ${startDate} to ${endDate}.`,
        type: "leave",
        read: false,
        actionUrl: "/dashboard/leaves",
        createdAt: nowISO(),
      });
    });

    await batch.commit();
    console.log(`Leave request notification sent to ${managersSnap.size} managers`);
  }
);

// ─────────────────────────────────────────────────────────────
// 2. LEAVE REQUEST UPDATED — Sync attendance on approval/cancel
// ─────────────────────────────────────────────────────────────
export const onLeaveRequestUpdated = onDocumentUpdated(
  "leaveRequests/{leaveId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    const {
      companyId,
      employeeId,
      employeeName,
      status,
      approvedByName,
      startDate,
      endDate,
      leaveTypeId,
      leaveTypeName,
      isHalfDay,
      halfDayDate,
    } = after;
    const leaveId = event.params.leaveId;

    // ── Notify employee of status change ──
    const statusLabels: Record<string, string> = {
      APPROVED: "Approved",
      REJECTED: "Rejected",
      CANCELLED: "Cancelled",
      PENDING_L2: "Escalated to Level 2",
      PENDING_L3: "Escalated to Level 3",
    };
    const statusLabel = statusLabels[status] || status;

    const notifRef = db.collection("notifications").doc();
    await notifRef.set({
      id: notifRef.id,
      companyId,
      userId: employeeId,
      title: `Leave Request ${statusLabel}`,
      message: `Your leave request has been ${statusLabel.toLowerCase()}${
        approvedByName ? ` by ${approvedByName}` : ""
      }.`,
      type: "leave",
      read: false,
      actionUrl: "/dashboard/leaves",
      createdAt: nowISO(),
    });

    // ── Notify next-level approvers for multi-level escalation ──
    if (status === "PENDING_L2" || status === "PENDING_L3") {
      const approvalChain = after.approvalChain || [];
      const currentLevel = after.currentApprovalLevel || 1;
      const nextStep = approvalChain.find(
        (s: { level: number; status: string }) => s.level === currentLevel && s.status === "PENDING"
      );
      if (nextStep?.approverId) {
        const approverNotifRef = db.collection("notifications").doc();
        await approverNotifRef.set({
          id: approverNotifRef.id,
          companyId,
          userId: nextStep.approverId,
          title: "Leave Request Awaiting Your Approval",
          message: `${employeeName}'s leave request (${startDate} to ${endDate}) requires your approval.`,
          type: "leave",
          read: false,
          actionUrl: "/dashboard/leaves",
          createdAt: nowISO(),
        });
      }
    }

    // ── APPROVED → sync attendance as ON_LEAVE ──
    if (before.status !== "APPROVED" && status === "APPROVED") {
      await syncLeaveToAttendance({
        companyId,
        employeeId,
        employeeName,
        startDate,
        endDate,
        leaveTypeId,
        leaveTypeName,
        leaveRequestId: leaveId,
        isHalfDay: isHalfDay ?? false,
        halfDayDate: halfDayDate ?? null,
      });
      console.log(`Synced attendance ON_LEAVE for ${employeeName} (${startDate}–${endDate})`);
    }

    // ── CANCELLED (was APPROVED) → revert attendance ──
    if (before.status === "APPROVED" && status === "CANCELLED") {
      await removeLeaveFromAttendance({
        companyId,
        employeeId,
        startDate,
        endDate,
        leaveRequestId: leaveId,
      });
      console.log(
        `Reverted attendance for cancelled leave: ${employeeName} (${startDate}–${endDate})`
      );
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Helper: Sync approved leave → attendance records
// ─────────────────────────────────────────────────────────────
async function syncLeaveToAttendance(params: {
  companyId: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveRequestId: string;
  isHalfDay: boolean;
  halfDayDate: string | null;
}): Promise<void> {
  const current = new Date(params.startDate);
  const end = new Date(params.endDate);
  const now = nowISO();

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const isHalfDayDate = params.isHalfDay && params.halfDayDate === dateStr;
    const id = makeDocId(params.employeeId, dateStr);
    const docRef = db.collection("attendance").doc(id);

    // Check if date is a mandatory holiday
    const holidaySnap = await db
      .collection("holidays")
      .where("companyId", "==", params.companyId)
      .where("date", "==", dateStr)
      .get();
    const isMandatoryHoliday = holidaySnap.docs.some((d) => !d.data().isOptional);

    if (isMandatoryHoliday) {
      // Holiday → don't mark as leave, mark as HOLIDAY instead
      const existing = await docRef.get();
      if (!existing.exists) {
        await docRef.set(
          stripUndefined({
            id,
            companyId: params.companyId,
            employeeId: params.employeeId,
            employeeName: params.employeeName,
            date: dateStr,
            checkIn: null,
            checkOut: null,
            sessions: [],
            totalWorkingHours: 0,
            overtimeHours: 0,
            status: "HOLIDAY",
            isLate: false,
            isOnLeave: false,
            isHalfDayLeave: false,
            auditLog: [{ action: "MARKED_HOLIDAY", performedBy: "system", performedAt: now }],
            createdAt: now,
            updatedAt: now,
          })
        );
      }
    } else {
      const existing = await docRef.get();
      if (existing.exists) {
        const rec = existing.data()!;
        const updates: Record<string, unknown> = {
          status: isHalfDayDate ? "HALF_DAY" : "ON_LEAVE",
          isOnLeave: true,
          isHalfDayLeave: isHalfDayDate || false,
          leaveTypeId: params.leaveTypeId,
          leaveTypeName: params.leaveTypeName,
          leaveRequestId: params.leaveRequestId,
          auditLog: [
            ...(rec.auditLog || []),
            {
              action: isHalfDayDate ? "MARKED_HALF_DAY_LEAVE" : "MARKED_ON_LEAVE",
              performedBy: "system",
              performedAt: now,
            },
          ],
          updatedAt: now,
        };
        if (!isHalfDayDate) {
          updates.sessions = [];
          updates.checkIn = null;
          updates.checkOut = null;
          updates.totalWorkingHours = 0;
          updates.overtimeHours = 0;
        }
        await docRef.update(stripUndefined(updates as Record<string, unknown>));
      } else {
        await docRef.set(
          stripUndefined({
            id,
            companyId: params.companyId,
            employeeId: params.employeeId,
            employeeName: params.employeeName,
            date: dateStr,
            checkIn: null,
            checkOut: null,
            sessions: [],
            totalWorkingHours: 0,
            overtimeHours: 0,
            status: isHalfDayDate ? "HALF_DAY" : "ON_LEAVE",
            isLate: false,
            isOnLeave: true,
            isHalfDayLeave: isHalfDayDate || false,
            leaveTypeId: params.leaveTypeId,
            leaveTypeName: params.leaveTypeName,
            leaveRequestId: params.leaveRequestId,
            auditLog: [
              {
                action: isHalfDayDate ? "MARKED_HALF_DAY_LEAVE" : "MARKED_ON_LEAVE",
                performedBy: "system",
                performedAt: now,
              },
            ],
            createdAt: now,
            updatedAt: now,
          })
        );
      }
    }

    current.setDate(current.getDate() + 1);
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: Remove leave from attendance on cancellation
// ─────────────────────────────────────────────────────────────
async function removeLeaveFromAttendance(params: {
  companyId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  leaveRequestId: string;
}): Promise<void> {
  const current = new Date(params.startDate);
  const end = new Date(params.endDate);
  const now = nowISO();

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const id = makeDocId(params.employeeId, dateStr);
    const docRef = db.collection("attendance").doc(id);

    try {
      const doc = await docRef.get();
      if (doc.exists) {
        const rec = doc.data()!;
        if (rec.isOnLeave && (!rec.leaveRequestId || rec.leaveRequestId === params.leaveRequestId)) {
          const hasSessions = (rec.sessions || []).length > 0;
          await docRef.update(
            stripUndefined({
              status: hasSessions ? "PRESENT" : "ABSENT",
              isOnLeave: false,
              isHalfDayLeave: false,
              leaveTypeId: undefined,
              leaveTypeName: undefined,
              leaveRequestId: undefined,
              auditLog: [
                ...(rec.auditLog || []),
                { action: "LEAVE_CANCELLED_REVERTED", performedBy: "system", performedAt: now },
              ],
              updatedAt: now,
            } as Record<string, unknown>)
          );
        }
      }
    } catch (err) {
      console.error(`Failed to revert attendance for ${dateStr}:`, err);
    }

    current.setDate(current.getDate() + 1);
  }
}

// ─────────────────────────────────────────────────────────────
// 3. NEW EMPLOYEE WELCOME NOTIFICATION
// ─────────────────────────────────────────────────────────────
export const onEmployeeCreated = onDocumentCreated(
  "employees/{employeeId}",
  async (event) => {
    const employee = event.data?.data();
    if (!employee) return;

    const { companyId, uid, firstName } = employee;

    const notifRef = db.collection("notifications").doc();
    await notifRef.set({
      id: notifRef.id,
      companyId,
      userId: uid,
      title: "Welcome to the team!",
      message: `Hi ${firstName}, welcome aboard! Check out your dashboard to get started.`,
      type: "system",
      read: false,
      actionUrl: "/dashboard",
      createdAt: nowISO(),
    });

    const adminsSnap = await db
      .collection("users")
      .where("companyId", "==", companyId)
      .where("role", "==", "COMPANY_ADMIN")
      .get();

    const batch = db.batch();
    adminsSnap.docs.forEach((adminDoc) => {
      if (adminDoc.id === uid) return;
      const ref = db.collection("notifications").doc();
      batch.set(ref, {
        id: ref.id,
        companyId,
        userId: adminDoc.id,
        title: "New Employee Added",
        message: `${employee.firstName} ${employee.lastName} has been added to the team.`,
        type: "system",
        read: false,
        actionUrl: "/dashboard/employees",
        createdAt: nowISO(),
      });
    });

    await batch.commit();
  }
);

// ─────────────────────────────────────────────────────────────
// 4. DAILY ATTENDANCE CRON — Mark absent / on-leave / holiday
//    Runs Mon-Fri at 11:30 PM IST (6:00 PM UTC)
// ─────────────────────────────────────────────────────────────
export const dailyAttendanceJob = onSchedule(
  { schedule: "0 18 * * 1-5", timeZone: "UTC" },
  async () => {
    const today = getTodayIST();
    const companiesSnap = await db.collection("companies").get();

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;

      // Get all active employees
      const empSnap = await db
        .collection("employees")
        .where("companyId", "==", companyId)
        .where("status", "==", "active")
        .get();

      // Get existing attendance records for today
      const attSnap = await db
        .collection("attendance")
        .where("companyId", "==", companyId)
        .where("date", "==", today)
        .get();
      const recorded = new Set(attSnap.docs.map((d) => d.data().employeeId));

      // Check if today is a holiday
      const holidaySnap = await db
        .collection("holidays")
        .where("companyId", "==", companyId)
        .where("date", "==", today)
        .get();
      const isMandatoryHoliday = holidaySnap.docs.some((d) => !d.data().isOptional);

      // Get approved leaves covering today
      const leavesSnap = await db
        .collection("leaveRequests")
        .where("companyId", "==", companyId)
        .where("status", "==", "APPROVED")
        .where("startDate", "<=", today)
        .get();
      const onLeaveMap = new Map<string, FirebaseFirestore.DocumentData>();
      for (const ldoc of leavesSnap.docs) {
        const lr = ldoc.data();
        if (lr.endDate >= today) {
          onLeaveMap.set(lr.employeeId, { ...lr, id: ldoc.id });
        }
      }

      const now = nowISO();
      const batch = db.batch();
      let count = 0;

      for (const empDoc of empSnap.docs) {
        const empId = empDoc.id;
        if (recorded.has(empId)) continue; // already has a record

        const empData = empDoc.data();
        const empName = `${empData.firstName} ${empData.lastName}`;
        const id = makeDocId(empId, today);
        const docRef = db.collection("attendance").doc(id);

        let status = "ABSENT";
        let isOnLeave = false;
        let isHalfDayLeave = false;
        let leaveTypeId: string | undefined;
        let leaveTypeName: string | undefined;
        let leaveRequestId: string | undefined;
        let action = "MARKED_ABSENT_BY_SYSTEM";

        if (isMandatoryHoliday) {
          status = "HOLIDAY";
          action = "MARKED_HOLIDAY";
        } else {
          const leaveReq = onLeaveMap.get(empId);
          if (leaveReq) {
            const halfDay = leaveReq.isHalfDay && leaveReq.halfDayDate === today;
            status = halfDay ? "HALF_DAY" : "ON_LEAVE";
            isOnLeave = true;
            isHalfDayLeave = halfDay;
            leaveTypeId = leaveReq.leaveTypeId;
            leaveTypeName = leaveReq.leaveTypeName;
            leaveRequestId = leaveReq.id;
            action = halfDay ? "MARKED_HALF_DAY_LEAVE" : "MARKED_ON_LEAVE";
          }
        }

        batch.set(
          docRef,
          stripUndefined({
            id,
            companyId,
            employeeId: empId,
            employeeName: empName,
            date: today,
            checkIn: null,
            checkOut: null,
            sessions: [],
            totalWorkingHours: 0,
            overtimeHours: 0,
            status,
            isLate: false,
            isOnLeave,
            isHalfDayLeave,
            leaveTypeId,
            leaveTypeName,
            leaveRequestId,
            auditLog: [{ action, performedBy: "system", performedAt: now }],
            createdAt: now,
            updatedAt: now,
          } as Record<string, unknown>)
        );
        count++;
      }

      if (count > 0) await batch.commit();

      // Send daily report to admins
      const stats = {
        total: empSnap.size,
        recorded: recorded.size,
        newMarked: count,
      };
      const adminsSnap = await db
        .collection("users")
        .where("companyId", "==", companyId)
        .where("role", "in", ["COMPANY_ADMIN"])
        .get();
      const reportBatch = db.batch();
      adminsSnap.docs.forEach((adminDoc) => {
        const ref = db.collection("notifications").doc();
        reportBatch.set(ref, {
          id: ref.id,
          companyId,
          userId: adminDoc.id,
          title: "Daily Attendance Report",
          message: `Today's attendance: ${stats.recorded} checked in, ${stats.newMarked} auto-marked (${isMandatoryHoliday ? "holiday" : "absent/leave"}).`,
          type: "attendance",
          read: false,
          actionUrl: "/dashboard/attendance",
          createdAt: nowISO(),
        });
      });
      await reportBatch.commit();

      console.log(
        `[${companyId}] Daily attendance: ${count} records created for ${today}`
      );
    }
  }
);

// ─────────────────────────────────────────────────────────────
// 5. MONTHLY PAYROLL REMINDER (Scheduled — 20th of each month)
// ─────────────────────────────────────────────────────────────
export const monthlyPayrollReminder = onSchedule(
  { schedule: "0 9 20 * *", timeZone: "UTC" },
  async () => {
    const companiesSnap = await db.collection("companies").get();

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      const company = companyDoc.data();

      const adminsSnap = await db
        .collection("users")
        .where("companyId", "==", companyId)
        .where("role", "==", "COMPANY_ADMIN")
        .get();

      const batch = db.batch();
      adminsSnap.docs.forEach((adminDoc) => {
        const ref = db.collection("notifications").doc();
        batch.set(ref, {
          id: ref.id,
          companyId,
          userId: adminDoc.id,
          title: "Payroll Reminder",
          message: `Monthly payroll processing is due on the ${company.settings?.payrollDay || 25}th. Please review and finalize payroll records.`,
          type: "payroll",
          read: false,
          actionUrl: "/dashboard/payroll",
          createdAt: nowISO(),
        });
      });

      await batch.commit();
    }

    console.log("Monthly payroll reminders sent");
  }
);

// ─────────────────────────────────────────────────────────────
// 6. ANNUAL LEAVE BALANCE RESET (Jan 1 — with carry-forward)
// ─────────────────────────────────────────────────────────────
export const annualLeaveBalanceReset = onSchedule(
  { schedule: "0 0 1 1 *", timeZone: "UTC" },
  async () => {
    const newYear = new Date().getFullYear();
    const prevYear = newYear - 1;
    const companiesSnap = await db.collection("companies").get();

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;

      // Get active policies for carry-forward calculation
      const policiesSnap = await db
        .collection("leavePolicies")
        .where("companyId", "==", companyId)
        .where("isActive", "==", true)
        .get();
      const policies = policiesSnap.docs.map((d) => d.data());

      const employeesSnap = await db
        .collection("employees")
        .where("companyId", "==", companyId)
        .where("status", "==", "active")
        .get();

      const batch = db.batch();
      let count = 0;

      for (const empDoc of employeesSnap.docs) {
        const employeeId = empDoc.id;

        for (const policy of policies) {
          // Get leave type name
          const typeDoc = await db.collection("leaveTypes").doc(policy.leaveTypeId).get();
          if (!typeDoc.exists) continue;
          const lt = typeDoc.data()!;

          // Calculate carry-forward from previous year
          let carryDays = 0;
          if (policy.carryForward) {
            const oldBalId = `${employeeId}_${policy.leaveTypeId}_${prevYear}`;
            const oldBalDoc = await db.collection("leaveBalances").doc(oldBalId).get();
            if (oldBalDoc.exists) {
              const oldBal = oldBalDoc.data()!;
              carryDays = Math.min(
                oldBal.remaining || 0,
                policy.maxCarryForwardDays || 0
              );
            }
          }

          const newBalId = `${employeeId}_${policy.leaveTypeId}_${newYear}`;
          batch.set(db.collection("leaveBalances").doc(newBalId), {
            id: newBalId,
            companyId,
            employeeId,
            leaveTypeId: policy.leaveTypeId,
            leaveTypeName: lt.name,
            year: newYear,
            totalAllocated: policy.annualQuota + carryDays,
            used: 0,
            remaining: policy.annualQuota + carryDays,
            carryForward: carryDays,
            encashed: 0,
            updatedAt: nowISO(),
          });
          count++;
        }
      }

      await batch.commit();
      console.log(
        `Reset ${count} leave balances for company ${companyId} (year ${newYear})`
      );
    }
  }
);

// ─────────────────────────────────────────────────────────────
// 7. MONTHLY LEAVE ACCRUAL (1st of each month)
// ─────────────────────────────────────────────────────────────
export const monthlyLeaveAccrual = onSchedule(
  { schedule: "0 1 1 * *", timeZone: "UTC" },
  async () => {
    const year = new Date().getFullYear();
    const companiesSnap = await db.collection("companies").get();

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;

      const policiesSnap = await db
        .collection("leavePolicies")
        .where("companyId", "==", companyId)
        .where("isActive", "==", true)
        .get();
      const accrualPolicies = policiesSnap.docs
        .map((d) => d.data())
        .filter((p) => p.monthlyAccrual);

      if (accrualPolicies.length === 0) continue;

      const empSnap = await db
        .collection("employees")
        .where("companyId", "==", companyId)
        .where("status", "==", "active")
        .get();

      const batch = db.batch();
      let count = 0;

      for (const empDoc of empSnap.docs) {
        for (const policy of accrualPolicies) {
          const monthlyAmount = Math.round((policy.annualQuota / 12) * 100) / 100;
          const balId = `${empDoc.id}_${policy.leaveTypeId}_${year}`;
          const balRef = db.collection("leaveBalances").doc(balId);
          const balDoc = await balRef.get();

          if (balDoc.exists) {
            const bal = balDoc.data()!;
            batch.update(balRef, {
              totalAllocated: (bal.totalAllocated || 0) + monthlyAmount,
              remaining: (bal.remaining || 0) + monthlyAmount,
              updatedAt: nowISO(),
            });
            count++;
          }
        }
      }

      if (count > 0) await batch.commit();
      console.log(`Monthly accrual: ${count} balances updated for ${companyId}`);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// 8. SYNC CUSTOM CLAIMS (Callable — for admin use)
// ─────────────────────────────────────────────────────────────
export const syncCustomClaims = onCall(async (request) => {
  const callerRole = request.auth?.token?.role;
  if (!callerRole || !["SUPER_ADMIN", "COMPANY_ADMIN"].includes(callerRole)) {
    throw new HttpsError("permission-denied", "Only admins can sync claims");
  }

  const uid = request.data?.uid;
  if (!uid) throw new HttpsError("invalid-argument", "uid is required");

  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new HttpsError("not-found", "User not found");

  const userData = userDoc.data()!;
  await admin.auth().setCustomUserClaims(uid, {
    role: userData.role,
    companyId: userData.companyId,
  });

  return { success: true, message: `Claims synced for ${uid}` };
});
