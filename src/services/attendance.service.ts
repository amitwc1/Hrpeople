import { adminDb } from "@/lib/firebase/admin";
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  AttendanceLocation,
  AttendanceAuditEntry,
  Shift,
  CompanyAttendanceStats,
  LeaveRequest,
} from "@/types";

const COLLECTION = "attendance";

/** Remove keys with undefined values (Firestore rejects undefined) */
function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}
const SHIFTS_COLLECTION = "shifts";

// ─── Helpers ──────────────────────────────────────────────────

/** Get current date in YYYY-MM-DD format (IST) */
function getTodayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Get current ISO timestamp */
function nowISO(): string {
  return new Date().toISOString();
}

/** Generate deterministic doc ID: employeeId_YYYY-MM-DD */
function makeDocId(employeeId: string, date: string): string {
  return `${employeeId}_${date}`;
}

/** Calculate hours between two ISO timestamps */
function hoursBetween(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
}

/** Calculate total working hours from sessions */
function calculateSessionHours(sessions: AttendanceSession[]): number {
  let total = 0;
  for (const s of sessions) {
    if (s.checkIn && s.checkOut) {
      total += hoursBetween(s.checkIn, s.checkOut);
    }
  }
  return Math.round(total * 100) / 100;
}

/** Determine attendance status based on hours and shift */
function determineStatus(
  totalHours: number,
  isLate: boolean,
  shiftHours: number
): AttendanceStatus {
  if (totalHours === 0) return "ABSENT";
  if (totalHours < shiftHours / 2) return "HALF_DAY";
  if (isLate) return "LATE";
  return "PRESENT";
}

/** Check if check-in time is late relative to shift */
function checkIfLate(checkInISO: string, shiftStartTime: string, graceMinutes: number): boolean {
  const checkIn = new Date(checkInISO);
  const istDate = checkIn.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [hours, minutes] = shiftStartTime.split(":").map(Number);
  const shiftStart = new Date(
    `${istDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+05:30`
  );
  const allowedTime = new Date(shiftStart.getTime() + graceMinutes * 60 * 1000);
  return checkIn > allowedTime;
}

// ─── Service ──────────────────────────────────────────────────

export class AttendanceService {
  // ═══════════════════════════════════════════════════════════
  // CLOCK IN
  // ═══════════════════════════════════════════════════════════
  static async clockIn(
    companyId: string,
    employeeId: string,
    employeeName: string,
    options?: {
      location?: AttendanceLocation;
      deviceInfo?: string;
      notes?: string;
    }
  ): Promise<AttendanceRecord> {
    const today = getTodayIST();
    const id = makeDocId(employeeId, today);
    const docRef = adminDb.collection(COLLECTION).doc(id);
    const now = nowISO();

    // Get employee's shift (or company default)
    const shift = await this.getEmployeeShift(companyId, employeeId);
    const isLate = shift
      ? checkIfLate(now, shift.startTime, shift.graceMinutes)
      : false;

    // Use Firestore transaction to prevent duplicates / race conditions
    return adminDb.runTransaction(async (txn) => {
      const doc = await txn.get(docRef);

      if (doc.exists) {
        const existing = doc.data() as AttendanceRecord;
        if (existing.companyId !== companyId) throw new Error("Access denied");

        // ── Leave guard: block clock-in on full leave days ──
        if (existing.isOnLeave && !existing.isHalfDayLeave) {
          throw new Error("You are on approved leave for today. Clock-in is disabled.");
        }

        // Check for an open session
        const lastSession = existing.sessions[existing.sessions.length - 1];
        if (lastSession && !lastSession.checkOut) {
          throw new Error("You have an active session. Please clock out first.");
        }

        // Add a new session (e.g., after a break)
        const newSession: AttendanceSession = { checkIn: now, checkOut: null };
        const sessions = [...existing.sessions, newSession];

        const updates: Partial<AttendanceRecord> = {
          sessions,
          checkOut: null,
          // If coming back from half-day leave, update status to HALF_DAY
          status: existing.isHalfDayLeave ? "HALF_DAY" : existing.status,
          updatedAt: now,
        };
        if (options?.location) updates.location = options.location;
        if (options?.deviceInfo) updates.deviceInfo = options.deviceInfo;

        txn.update(docRef, stripUndefined(updates));
        return { ...existing, ...updates } as AttendanceRecord;
      }

      // First clock-in of the day — check for approved leave
      const leaveBlock = await AttendanceService.checkLeaveForDate(companyId, employeeId, today);
      if (leaveBlock && !leaveBlock.isHalfDay) {
        throw new Error("You are on approved leave for today. Clock-in is disabled.");
      }

      const record: AttendanceRecord = {
        id,
        companyId,
        employeeId,
        employeeName,
        date: today,
        checkIn: now,
        checkOut: null,
        sessions: [{ checkIn: now, checkOut: null }],
        totalWorkingHours: 0,
        overtimeHours: 0,
        status: leaveBlock?.isHalfDay ? "HALF_DAY" : (isLate ? "LATE" : "PRESENT"),
        isLate,
        isOnLeave: !!leaveBlock,
        isHalfDayLeave: leaveBlock?.isHalfDay ?? false,
        leaveTypeId: leaveBlock?.leaveTypeId,
        leaveTypeName: leaveBlock?.leaveTypeName,
        leaveRequestId: leaveBlock?.leaveRequestId,
        shiftId: shift?.id,
        location: options?.location,
        deviceInfo: options?.deviceInfo,
        notes: options?.notes,
        auditLog: [
          {
            action: "CLOCK_IN",
            performedBy: employeeId,
            performedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      txn.set(docRef, stripUndefined(record));
      return record;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CLOCK OUT
  // ═══════════════════════════════════════════════════════════
  static async clockOut(
    companyId: string,
    employeeId: string,
    options?: {
      location?: AttendanceLocation;
      notes?: string;
    }
  ): Promise<AttendanceRecord> {
    const today = getTodayIST();
    const id = makeDocId(employeeId, today);
    const docRef = adminDb.collection(COLLECTION).doc(id);
    const now = nowISO();

    const shift = await this.getEmployeeShift(companyId, employeeId);
    const shiftHours = shift?.workingHours ?? 8;

    return adminDb.runTransaction(async (txn) => {
      const doc = await txn.get(docRef);

      if (!doc.exists)
        throw new Error("No attendance record for today. Please clock in first.");

      const record = doc.data() as AttendanceRecord;
      if (record.companyId !== companyId) throw new Error("Access denied");

      // ── Leave guard: block clock-out on full leave days ──
      if (record.isOnLeave && !record.isHalfDayLeave) {
        throw new Error("You are on approved leave for today. Clock-out is disabled.");
      }

      const sessions = [...record.sessions];
      const openIdx = sessions.findIndex((s) => s.checkIn && !s.checkOut);
      if (openIdx === -1) throw new Error("No active session to clock out.");

      sessions[openIdx] = { ...sessions[openIdx], checkOut: now };

      const totalWorkingHours = calculateSessionHours(sessions);
      const overtimeHours = Math.max(
        0,
        Math.round((totalWorkingHours - shiftHours) * 100) / 100
      );
      const status = determineStatus(totalWorkingHours, record.isLate, shiftHours);

      const auditLog: AttendanceAuditEntry[] = [
        ...record.auditLog,
        { action: "CLOCK_OUT", performedBy: employeeId, performedAt: now },
      ];

      const updates: Partial<AttendanceRecord> = {
        sessions,
        checkOut: now,
        totalWorkingHours,
        overtimeHours,
        status,
        auditLog,
        notes: options?.notes || record.notes,
        updatedAt: now,
      };
      if (options?.location) updates.location = options.location;

      txn.update(docRef, stripUndefined(updates));
      return { ...record, ...updates } as AttendanceRecord;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GET TODAY
  // ═══════════════════════════════════════════════════════════
  static async getToday(
    companyId: string,
    employeeId: string
  ): Promise<AttendanceRecord | null> {
    const today = getTodayIST();
    const id = makeDocId(employeeId, today);
    const doc = await adminDb.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    const record = doc.data() as AttendanceRecord;
    if (record.companyId !== companyId) return null;
    return record;
  }

  // ═══════════════════════════════════════════════════════════
  // GET HISTORY (date range)
  // ═══════════════════════════════════════════════════════════
  static async getHistory(
    companyId: string,
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<AttendanceRecord[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("employeeId", "==", employeeId)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    const records = snapshot.docs.map((d) => d.data() as AttendanceRecord);
    records.sort((a, b) => b.date.localeCompare(a.date));
    return records;
  }

  // ═══════════════════════════════════════════════════════════
  // COMPANY ATTENDANCE FOR A DATE
  // ═══════════════════════════════════════════════════════════
  static async getCompanyAttendance(
    companyId: string,
    date?: string
  ): Promise<AttendanceRecord[]> {
    const targetDate = date || getTodayIST();
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("date", "==", targetDate)
      .get();

    return snapshot.docs.map((d) => d.data() as AttendanceRecord);
  }

  // ═══════════════════════════════════════════════════════════
  // COMPANY STATS
  // ═══════════════════════════════════════════════════════════
  static async getCompanyStats(
    companyId: string,
    date?: string
  ): Promise<CompanyAttendanceStats> {
    const targetDate = date || getTodayIST();
    const records = await this.getCompanyAttendance(companyId, targetDate);

    const totalEmpSnap = await adminDb
      .collection("employees")
      .where("companyId", "==", companyId)
      .where("status", "==", "active")
      .get();
    const total = totalEmpSnap.size;

    let present = 0,
      late = 0,
      halfDay = 0,
      onLeave = 0,
      holiday = 0;
    for (const r of records) {
      switch (r.status) {
        case "PRESENT":
          present++;
          break;
        case "LATE":
          late++;
          break;
        case "HALF_DAY":
          halfDay++;
          break;
        case "ON_LEAVE":
          onLeave++;
          break;
        case "HOLIDAY":
          holiday++;
          break;
      }
    }

    const accounted = present + late + halfDay + onLeave + holiday;
    const absent = Math.max(0, total - accounted);

    return { present, absent, late, halfDay, onLeave, holiday, total, date: targetDate };
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN UPDATE (manual correction with audit)
  // ═══════════════════════════════════════════════════════════
  static async adminUpdate(
    companyId: string,
    attendanceId: string,
    adminId: string,
    updates: {
      checkIn?: string;
      checkOut?: string;
      status?: AttendanceStatus;
      notes?: string;
    }
  ): Promise<AttendanceRecord> {
    const docRef = adminDb.collection(COLLECTION).doc(attendanceId);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Attendance record not found");

    const record = doc.data() as AttendanceRecord;
    if (record.companyId !== companyId) throw new Error("Access denied");

    const now = nowISO();
    const previousValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (updates.checkIn && updates.checkIn !== record.checkIn) {
      previousValue.checkIn = record.checkIn;
      newValue.checkIn = updates.checkIn;
    }
    if (updates.checkOut && updates.checkOut !== record.checkOut) {
      previousValue.checkOut = record.checkOut;
      newValue.checkOut = updates.checkOut;
    }
    if (updates.status && updates.status !== record.status) {
      previousValue.status = record.status;
      newValue.status = updates.status;
    }

    // Recalculate sessions if times changed
    let sessions = [...record.sessions];
    const shift = await this.getEmployeeShift(companyId, record.employeeId);
    const shiftHours = shift?.workingHours ?? 8;

    if (updates.checkIn || updates.checkOut) {
      if (sessions.length === 0) {
        sessions = [{ checkIn: updates.checkIn || now, checkOut: updates.checkOut || null }];
      } else {
        if (updates.checkIn) {
          sessions[0] = { ...sessions[0], checkIn: updates.checkIn };
        }
        if (updates.checkOut) {
          sessions[sessions.length - 1] = {
            ...sessions[sessions.length - 1],
            checkOut: updates.checkOut,
          };
        }
      }
    }

    const totalWorkingHours = calculateSessionHours(sessions);
    const overtimeHours = Math.max(
      0,
      Math.round((totalWorkingHours - shiftHours) * 100) / 100
    );
    const isLate =
      updates.checkIn && shift
        ? checkIfLate(updates.checkIn, shift.startTime, shift.graceMinutes)
        : record.isLate;
    const status =
      updates.status || determineStatus(totalWorkingHours, isLate, shiftHours);

    const auditEntry: AttendanceAuditEntry = {
      action: "ADMIN_UPDATE",
      performedBy: adminId,
      performedAt: now,
      previousValue,
      newValue,
    };

    const merged: Partial<AttendanceRecord> = {
      checkIn: updates.checkIn || record.checkIn,
      checkOut: updates.checkOut || record.checkOut,
      sessions,
      totalWorkingHours,
      overtimeHours,
      status,
      isLate,
      notes: updates.notes ?? record.notes,
      auditLog: [...record.auditLog, auditEntry],
      updatedAt: now,
    };

    await docRef.update(stripUndefined(merged));
    return { ...record, ...merged } as AttendanceRecord;
  }

  // ═══════════════════════════════════════════════════════════
  // MARK ON-LEAVE (called by leave service on approval)
  // ═══════════════════════════════════════════════════════════
  static async markOnLeave(
    companyId: string,
    employeeId: string,
    employeeName: string,
    date: string,
    leaveInfo?: {
      leaveTypeId?: string;
      leaveTypeName?: string;
      leaveRequestId?: string;
      isHalfDay?: boolean;
    }
  ): Promise<AttendanceRecord> {
    const id = makeDocId(employeeId, date);
    const docRef = adminDb.collection(COLLECTION).doc(id);
    const now = nowISO();

    // Check if this date is a company holiday
    const isHoliday = await this.isCompanyHoliday(companyId, date);
    if (isHoliday) {
      // Holiday takes priority — mark as HOLIDAY, don't overwrite
      const existing = await docRef.get();
      if (existing.exists) {
        const rec = existing.data() as AttendanceRecord;
        if (rec.status === "HOLIDAY") return rec; // already correct
      }
      // Create/update as HOLIDAY
      const record: AttendanceRecord = {
        id,
        companyId,
        employeeId,
        employeeName,
        date,
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
      };
      await docRef.set(stripUndefined(record));
      return record;
    }

    const isHalfDay = leaveInfo?.isHalfDay ?? false;

    const existing = await docRef.get();
    if (existing.exists) {
      const rec = existing.data() as AttendanceRecord;

      // If employee was PRESENT and not a half-day leave, overwrite to ON_LEAVE
      const updates: Partial<AttendanceRecord> = {
        status: isHalfDay ? "HALF_DAY" : "ON_LEAVE",
        isOnLeave: true,
        isHalfDayLeave: isHalfDay,
        leaveTypeId: leaveInfo?.leaveTypeId,
        leaveTypeName: leaveInfo?.leaveTypeName,
        leaveRequestId: leaveInfo?.leaveRequestId,
        auditLog: [
          ...rec.auditLog,
          {
            action: isHalfDay ? "MARKED_HALF_DAY_LEAVE" : "MARKED_ON_LEAVE",
            performedBy: "system",
            performedAt: now,
          },
        ],
        updatedAt: now,
      };

      // For full-day leave, wipe sessions
      if (!isHalfDay) {
        updates.sessions = [];
        updates.checkIn = null;
        updates.checkOut = null;
        updates.totalWorkingHours = 0;
        updates.overtimeHours = 0;
      }

      await docRef.update(stripUndefined(updates));
      return { ...rec, ...updates } as AttendanceRecord;
    }

    // No existing record — create a new one
    const record: AttendanceRecord = {
      id,
      companyId,
      employeeId,
      employeeName,
      date,
      checkIn: null,
      checkOut: null,
      sessions: [],
      totalWorkingHours: 0,
      overtimeHours: 0,
      status: isHalfDay ? "HALF_DAY" : "ON_LEAVE",
      isLate: false,
      isOnLeave: true,
      isHalfDayLeave: isHalfDay,
      leaveTypeId: leaveInfo?.leaveTypeId,
      leaveTypeName: leaveInfo?.leaveTypeName,
      leaveRequestId: leaveInfo?.leaveRequestId,
      auditLog: [
        {
          action: isHalfDay ? "MARKED_HALF_DAY_LEAVE" : "MARKED_ON_LEAVE",
          performedBy: "system",
          performedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(stripUndefined(record));
    return record;
  }

  // ═══════════════════════════════════════════════════════════
  // REMOVE LEAVE FROM ATTENDANCE (called on leave cancellation)
  // ═══════════════════════════════════════════════════════════
  static async removeLeaveFromAttendance(
    leave: LeaveRequest
  ): Promise<void> {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const current = new Date(start);
    const now = nowISO();

    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      const id = makeDocId(leave.employeeId, dateStr);
      const docRef = adminDb.collection(COLLECTION).doc(id);

      try {
        const doc = await docRef.get();
        if (doc.exists) {
          const rec = doc.data() as AttendanceRecord;
          // Only revert if this record was set by THIS leave request
          if (rec.isOnLeave && (!rec.leaveRequestId || rec.leaveRequestId === leave.id)) {
            const hasWorkSessions = rec.sessions.length > 0 && rec.sessions.some(s => s.checkIn);

            if (hasWorkSessions) {
              // Had some clock-in data — recalculate, mark as regular status
              const shift = await this.getEmployeeShift(leave.companyId, leave.employeeId);
              const shiftHours = shift?.workingHours ?? 8;
              const totalWorkingHours = calculateSessionHours(rec.sessions);
              const status = determineStatus(totalWorkingHours, rec.isLate, shiftHours);

              await docRef.update(stripUndefined({
                status,
                isOnLeave: false,
                isHalfDayLeave: false,
                leaveTypeId: undefined,
                leaveTypeName: undefined,
                leaveRequestId: undefined,
                totalWorkingHours,
                auditLog: [
                  ...rec.auditLog,
                  { action: "LEAVE_CANCELLED_REVERTED", performedBy: "system", performedAt: now },
                ],
                updatedAt: now,
              }));
            } else {
              // No work sessions — reset to ABSENT (allows fresh clock-in)
              await docRef.update(stripUndefined({
                status: "ABSENT" as AttendanceStatus,
                isOnLeave: false,
                isHalfDayLeave: false,
                leaveTypeId: undefined,
                leaveTypeName: undefined,
                leaveRequestId: undefined,
                auditLog: [
                  ...rec.auditLog,
                  { action: "LEAVE_CANCELLED_RESET_ABSENT", performedBy: "system", performedAt: now },
                ],
                updatedAt: now,
              }));
            }
          }
        }
      } catch {
        // Best-effort per date
      }
      current.setDate(current.getDate() + 1);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // VALIDATE: Check if attendance conflicts with leave approval
  // ═══════════════════════════════════════════════════════════
  static async validateAttendanceBeforeLeave(
    companyId: string,
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<{ conflicts: { date: string; status: AttendanceStatus }[] }> {
    const conflicts: { date: string; status: AttendanceStatus }[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      const id = makeDocId(employeeId, dateStr);
      const doc = await adminDb.collection(COLLECTION).doc(id).get();

      if (doc.exists) {
        const rec = doc.data() as AttendanceRecord;
        if (rec.companyId === companyId && rec.status === "PRESENT") {
          conflicts.push({ date: dateStr, status: rec.status });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return { conflicts };
  }

  // ═══════════════════════════════════════════════════════════
  // MARK HOLIDAY (for a date)
  // ═══════════════════════════════════════════════════════════
  static async markHoliday(
    companyId: string,
    date: string
  ): Promise<number> {
    const empSnap = await adminDb
      .collection("employees")
      .where("companyId", "==", companyId)
      .where("status", "==", "active")
      .get();

    const now = nowISO();
    let count = 0;
    const batch = adminDb.batch();

    for (const empDoc of empSnap.docs) {
      const empId = empDoc.id;
      const empName = `${empDoc.data().firstName} ${empDoc.data().lastName}`;
      const id = makeDocId(empId, date);
      const docRef = adminDb.collection(COLLECTION).doc(id);
      const existing = await docRef.get();

      if (!existing.exists) {
        const record: AttendanceRecord = {
          id,
          companyId,
          employeeId: empId,
          employeeName: empName,
          date,
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
        };
        batch.set(docRef, stripUndefined(record));
        count++;
      } else {
        const rec = existing.data() as AttendanceRecord;
        if (rec.status !== "PRESENT" && rec.status !== "LATE") {
          // Don't overwrite if already clocked in
          batch.update(docRef, { status: "HOLIDAY", updatedAt: now });
          count++;
        }
      }
    }

    if (count > 0) await batch.commit();
    return count;
  }

  // ═══════════════════════════════════════════════════════════
  // MARK ABSENT (for daily cron — also marks ON_LEAVE & HOLIDAY)
  // ═══════════════════════════════════════════════════════════
  static async markAbsentForDate(
    companyId: string,
    date: string
  ): Promise<number> {
    const empSnap = await adminDb
      .collection("employees")
      .where("companyId", "==", companyId)
      .where("status", "==", "active")
      .get();

    const employees = empSnap.docs.map((d) => ({
      id: d.id,
      name: `${d.data().firstName} ${d.data().lastName}`,
    }));

    const attSnap = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("date", "==", date)
      .get();
    const recorded = new Set(
      attSnap.docs.map((d) => (d.data() as AttendanceRecord).employeeId)
    );

    // Check if date is a holiday
    const isHoliday = await this.isCompanyHoliday(companyId, date);

    // Get all approved leaves covering this date
    const leavesSnap = await adminDb
      .collection("leaveRequests")
      .where("companyId", "==", companyId)
      .where("status", "==", "APPROVED")
      .where("startDate", "<=", date)
      .get();
    const onLeaveMap = new Map<string, LeaveRequest>();
    for (const doc of leavesSnap.docs) {
      const lr = doc.data() as LeaveRequest;
      if (lr.endDate >= date) {
        onLeaveMap.set(lr.employeeId, lr);
      }
    }

    const now = nowISO();
    let count = 0;
    const batch = adminDb.batch();

    for (const emp of employees) {
      if (!recorded.has(emp.id)) {
        const id = makeDocId(emp.id, date);
        const docRef = adminDb.collection(COLLECTION).doc(id);

        const leaveReq = onLeaveMap.get(emp.id);
        let status: AttendanceStatus = "ABSENT";
        let isOnLeave = false;
        let isHalfDayLeave = false;
        let leaveTypeId: string | undefined;
        let leaveTypeName: string | undefined;
        let leaveRequestId: string | undefined;
        let action = "MARKED_ABSENT_BY_SYSTEM";

        if (isHoliday) {
          status = "HOLIDAY";
          action = "MARKED_HOLIDAY";
        } else if (leaveReq) {
          const halfDay = leaveReq.isHalfDay && leaveReq.halfDayDate === date;
          status = halfDay ? "HALF_DAY" : "ON_LEAVE";
          isOnLeave = true;
          isHalfDayLeave = halfDay;
          leaveTypeId = leaveReq.leaveTypeId;
          leaveTypeName = leaveReq.leaveTypeName;
          leaveRequestId = leaveReq.id;
          action = halfDay ? "MARKED_HALF_DAY_LEAVE" : "MARKED_ON_LEAVE";
        }

        const record: AttendanceRecord = {
          id,
          companyId,
          employeeId: emp.id,
          employeeName: emp.name,
          date,
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
        };
        batch.set(docRef, stripUndefined(record));
        count++;
      }
    }

    if (count > 0) await batch.commit();
    return count;
  }

  // ═══════════════════════════════════════════════════════════
  // SHIFT MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  static async createShift(
    companyId: string,
    data: Omit<Shift, "id" | "companyId" | "createdAt" | "updatedAt">
  ): Promise<Shift> {
    const docRef = adminDb.collection(SHIFTS_COLLECTION).doc();
    const now = nowISO();
    const shift: Shift = {
      id: docRef.id,
      companyId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(stripUndefined(shift));
    return shift;
  }

  static async getShifts(companyId: string): Promise<Shift[]> {
    const snap = await adminDb
      .collection(SHIFTS_COLLECTION)
      .where("companyId", "==", companyId)
      .get();
    return snap.docs.map((d) => d.data() as Shift);
  }

  static async updateShift(
    companyId: string,
    shiftId: string,
    data: Partial<Shift>
  ): Promise<Shift> {
    const docRef = adminDb.collection(SHIFTS_COLLECTION).doc(shiftId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Shift not found");
    const existing = doc.data() as Shift;
    if (existing.companyId !== companyId) throw new Error("Access denied");

    const updates = { ...data, updatedAt: nowISO() };
    await docRef.update(stripUndefined(updates));
    return { ...existing, ...updates } as Shift;
  }

  static async deleteShift(companyId: string, shiftId: string): Promise<void> {
    const docRef = adminDb.collection(SHIFTS_COLLECTION).doc(shiftId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Shift not found");
    if ((doc.data() as Shift).companyId !== companyId) throw new Error("Access denied");
    await docRef.delete();
  }

  /** Get employee's assigned shift, or company default */
  private static async getEmployeeShift(
    companyId: string,
    employeeId: string
  ): Promise<Shift | null> {
    const empDoc = await adminDb.collection("employees").doc(employeeId).get();
    if (empDoc.exists) {
      const shiftId = empDoc.data()?.shiftId;
      if (shiftId) {
        const shiftDoc = await adminDb
          .collection(SHIFTS_COLLECTION)
          .doc(shiftId)
          .get();
        if (shiftDoc.exists) {
          const shift = shiftDoc.data() as Shift;
          if (shift.companyId === companyId) return shift;
        }
      }
    }

    // Fall back to company default shift
    const defaultSnap = await adminDb
      .collection(SHIFTS_COLLECTION)
      .where("companyId", "==", companyId)
      .where("isDefault", "==", true)
      .get();

    if (!defaultSnap.empty) {
      return defaultSnap.docs[0].data() as Shift;
    }

    return null;
  }

  /** Check if a specific date has an approved leave for an employee */
  private static async checkLeaveForDate(
    companyId: string,
    employeeId: string,
    date: string
  ): Promise<{
    isHalfDay: boolean;
    leaveTypeId: string;
    leaveTypeName: string;
    leaveRequestId: string;
  } | null> {
    const snap = await adminDb
      .collection("leaveRequests")
      .where("companyId", "==", companyId)
      .where("employeeId", "==", employeeId)
      .where("status", "==", "APPROVED")
      .where("startDate", "<=", date)
      .get();

    for (const doc of snap.docs) {
      const lr = doc.data() as LeaveRequest;
      if (lr.endDate >= date) {
        const isHalfDay = lr.isHalfDay && lr.halfDayDate === date;
        return {
          isHalfDay,
          leaveTypeId: lr.leaveTypeId,
          leaveTypeName: lr.leaveTypeName,
          leaveRequestId: lr.id,
        };
      }
    }

    return null;
  }

  /** Check if a date is a company holiday */
  private static async isCompanyHoliday(
    companyId: string,
    date: string
  ): Promise<boolean> {
    const snap = await adminDb
      .collection("holidays")
      .where("companyId", "==", companyId)
      .where("date", "==", date)
      .get();
    // Only mandatory holidays count; optional holidays don't auto-block
    return snap.docs.some((d) => !(d.data().isOptional));
  }
}
