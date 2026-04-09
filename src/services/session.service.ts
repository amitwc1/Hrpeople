import { adminDb } from "@/lib/firebase/admin";
import type { EmployeeSession, SessionStatus, PaginationParams, Role } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "employee_sessions";

function parseUserAgent(ua: string | null): {
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string | null;
  os: string | null;
} {
  if (!ua) return { deviceType: "unknown", browser: null, os: null };

  // Device type
  let deviceType: "desktop" | "mobile" | "tablet" | "unknown" = "desktop";
  if (/tablet|ipad/i.test(ua)) deviceType = "tablet";
  else if (/mobile|android|iphone/i.test(ua)) deviceType = "mobile";

  // Browser
  let browser: string | null = null;
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  // OS
  let os: string | null = null;
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";

  return { deviceType, browser, os };
}

export const SessionService = {
  /** Start a new session when an employee logs in */
  async startSession(data: {
    companyId: string;
    employeeId: string;
    employeeName: string;
    email: string;
    role: Role;
    department: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<EmployeeSession> {
    const { deviceType, browser, os } = parseUserAgent(data.userAgent);
    const now = new Date().toISOString();

    const sessionData = {
      companyId: data.companyId,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      email: data.email,
      role: data.role,
      department: data.department,
      status: "ACTIVE" as SessionStatus,
      loginAt: now,
      logoutAt: null,
      durationMinutes: null,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      deviceType,
      browser,
      os,
      createdAt: now,
    };

    const docRef = await adminDb.collection(COLLECTION).add({
      ...sessionData,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { id: docRef.id, ...sessionData };
  },

  /** End a session when an employee logs out */
  async endSession(sessionId: string): Promise<void> {
    const docRef = adminDb.collection(COLLECTION).doc(sessionId);
    const doc = await docRef.get();
    if (!doc.exists) return;

    const session = doc.data()!;
    const loginAt = new Date(session.loginAt);
    const logoutAt = new Date();
    const durationMinutes = Math.round(
      (logoutAt.getTime() - loginAt.getTime()) / 60000
    );

    await docRef.update({
      status: "ENDED",
      logoutAt: logoutAt.toISOString(),
      durationMinutes,
    });
  },

  /** End all active sessions for a user (called on login to clean stale sessions) */
  async endActiveSessions(companyId: string, employeeId: string): Promise<void> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("employeeId", "==", employeeId)
      .where("status", "==", "ACTIVE")
      .get();

    const batch = adminDb.batch();
    const now = new Date();

    for (const doc of snapshot.docs) {
      const session = doc.data();
      const loginAt = new Date(session.loginAt);
      const durationMinutes = Math.round(
        (now.getTime() - loginAt.getTime()) / 60000
      );
      batch.update(doc.ref, {
        status: "EXPIRED",
        logoutAt: now.toISOString(),
        durationMinutes,
      });
    }

    if (!snapshot.empty) await batch.commit();
  },

  /** List sessions for a company (admin view) with filters */
  async list(
    companyId: string,
    params: PaginationParams & {
      employeeId?: string;
      status?: SessionStatus;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ sessions: EmployeeSession[]; total: number }> {
    const { page = 1, pageSize = 25, employeeId, status, startDate, endDate } = params;

    let query: FirebaseFirestore.Query = adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId);

    if (employeeId) {
      query = query.where("employeeId", "==", employeeId);
    }
    if (status) {
      query = query.where("status", "==", status);
    }
    if (startDate) {
      query = query.where("loginAt", ">=", startDate);
    }
    if (endDate) {
      query = query.where("loginAt", "<=", endDate + "T23:59:59.999Z");
    }

    // Get total count
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;

    // Paginate
    const snapshot = await query
      .orderBy("loginAt", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const sessions: EmployeeSession[] = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        companyId: d.companyId,
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        email: d.email,
        role: d.role,
        department: d.department,
        status: d.status,
        loginAt: d.loginAt,
        logoutAt: d.logoutAt,
        durationMinutes: d.durationMinutes,
        ipAddress: d.ipAddress,
        userAgent: d.userAgent,
        deviceType: d.deviceType,
        browser: d.browser,
        os: d.os,
        createdAt: d.loginAt,
      } as EmployeeSession;
    });

    return { sessions, total };
  },

  /** Get active sessions count for a company */
  async getActiveCount(companyId: string): Promise<number> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("status", "==", "ACTIVE")
      .count()
      .get();
    return snapshot.data().count;
  },

  /** Get sessions for a specific employee */
  async getByEmployee(
    companyId: string,
    employeeId: string,
    limit = 50
  ): Promise<EmployeeSession[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("employeeId", "==", employeeId)
      .orderBy("loginAt", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        companyId: d.companyId,
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        email: d.email,
        role: d.role,
        department: d.department,
        status: d.status,
        loginAt: d.loginAt,
        logoutAt: d.logoutAt,
        durationMinutes: d.durationMinutes,
        ipAddress: d.ipAddress,
        userAgent: d.userAgent,
        deviceType: d.deviceType,
        browser: d.browser,
        os: d.os,
        createdAt: d.loginAt,
      } as EmployeeSession;
    });
  },
};
