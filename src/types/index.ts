// ─── Role Definitions ─────────────────────────────────────────
export type Role = "SUPER_ADMIN" | "COMPANY_ADMIN" | "MANAGER" | "EMPLOYEE";

export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 4,
  COMPANY_ADMIN: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
};

// ─── User ─────────────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  companyId: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomClaims {
  role: Role;
  companyId: string;
}

// ─── Company / Tenant ─────────────────────────────────────────
export interface Company {
  id: string;
  name: string;
  domain: string;
  logo?: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  settings: CompanySettings;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  timezone: string;
  dateFormat: string;
  workingDays: number[]; // 0=Sun, 6=Sat
  workingHours: { start: string; end: string };
  leavePolicy: {
    annualLeave: number;
    sickLeave: number;
    casualLeave: number;
  };
  payrollDay: number; // Day of month
}

// ─── Employee ─────────────────────────────────────────────────
export interface Employee {
  id: string;
  companyId: string;
  uid: string; // Firebase Auth UID
  employeeId: string; // e.g., "EMP-001"
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  role: Role;
  managerId?: string;
  dateOfJoining: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  address?: Address;
  emergencyContact?: EmergencyContact;
  bankDetails?: BankDetails;
  status: "active" | "inactive" | "terminated";
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
}

// ─── Attendance ───────────────────────────────────────────────
export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LATE" | "ON_LEAVE" | "HOLIDAY";

export interface AttendanceSession {
  checkIn: string;   // ISO timestamp
  checkOut: string | null;
}

export interface AttendanceLocation {
  lat: number;
  lng: number;
}

export interface AttendanceAuditEntry {
  action: string;
  performedBy: string;
  performedAt: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export interface AttendanceRecord {
  id: string;              // employeeId_YYYY-MM-DD
  companyId: string;
  employeeId: string;
  employeeName: string;
  date: string;            // YYYY-MM-DD
  checkIn: string | null;  // first session check-in
  checkOut: string | null;  // last session check-out
  sessions: AttendanceSession[];
  totalWorkingHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
  isLate: boolean;
  isOnLeave: boolean;
  isHalfDayLeave: boolean;
  leaveTypeId?: string;
  leaveTypeName?: string;
  leaveRequestId?: string;
  shiftId?: string;
  location?: AttendanceLocation;
  deviceInfo?: string;
  notes?: string;
  auditLog: AttendanceAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  companyId: string;
  name: string;           // "Morning", "Evening", "Night"
  startTime: string;      // "09:00"
  endTime: string;        // "18:00"
  graceMinutes: number;   // e.g., 15 min grace for late
  workingHours: number;   // expected hours
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyAttendanceStats {
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  holiday: number;
  total: number;
  date: string;
}

// ─── Leave ────────────────────────────────────────────────────
export type LeaveStatus =
  | "PENDING"
  | "PENDING_L2"       // awaiting second-level approval
  | "PENDING_L3"       // awaiting third-level approval
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

/** Dynamic company-defined leave type (stored in Firestore) */
export interface CompanyLeaveType {
  id: string;
  companyId: string;
  name: string;           // "Casual Leave"
  code: string;           // "CL"
  isPaid: boolean;
  color: string;          // for UI badges, e.g. "#3b82f6"
  isActive: boolean;
  requiresAttachment: boolean;      // e.g. medical cert for sick > 2 days
  attachmentAfterDays: number;      // require cert if leave > N days (0 = always)
  isCompOff: boolean;               // compensatory off (earned via overtime)
  genderRestriction?: "male" | "female" | "other"; // e.g. maternity/paternity
  createdAt: string;
  updatedAt: string;
}

/** Approval chain level */
export interface ApprovalLevel {
  level: number;           // 1, 2, 3
  approverType: "REPORTING_MANAGER" | "DEPARTMENT_HEAD" | "COMPANY_ADMIN" | "SPECIFIC_USER";
  specificUserId?: string; // only when approverType = SPECIFIC_USER
  requiredAboveDays: number; // L2 needed if totalDays > this (0 = always)
}

/** Policy rules for a specific leave type within a company */
export interface LeavePolicy {
  id: string;
  companyId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  annualQuota: number;            // e.g. 12 days/year
  monthlyAccrual: boolean;        // if true, quota drips monthly
  carryForward: boolean;
  maxCarryForwardDays: number;    // 0 = no carry
  probationRestricted: boolean;   // block during probation
  probationMonths: number;        // probation duration (default 6)
  minDaysPerRequest: number;      // e.g. 0.5
  maxDaysPerRequest: number;      // e.g. 30
  sandwichPolicy: boolean;        // weekends between leaves count
  includeWeekends: boolean;       // weekend days counted as leave
  includeHolidays: boolean;       // holiday days counted as leave
  allowHalfDay: boolean;
  allowBackdated: boolean;
  maxBackdatedDays: number;       // how far back you can apply
  advanceNoticeDays: number;      // must apply N days before start
  allowNegativeBalance: boolean;  // allow going below 0
  maxNegativeBalance: number;     // how far negative (e.g. 3 days)
  allowEncashment: boolean;       // year-end cash payout
  maxEncashmentDays: number;      // e.g. 10
  proRataForNewJoiners: boolean;  // calculate based on joining month
  approvalLevels: ApprovalLevel[]; // multi-level approval chain
  blackoutDates: string[];         // YYYY-MM-DD dates when leave is blocked
  departmentQuotaPercent: number;  // max % of dept on leave at once (0 = unlimited)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Per-employee, per-leave-type, per-year balance */
export interface LeaveBalance {
  id: string;              // employeeId_leaveTypeId_year
  companyId: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  totalAllocated: number;
  used: number;
  remaining: number;
  carryForward: number;
  encashed: number;        // days converted to cash
  updatedAt: string;
}

/** Approval step within a leave request */
export interface ApprovalStep {
  level: number;
  approverId: string;
  approverName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  comment?: string;
  actionAt?: string;       // ISO timestamp
}

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;        // YYYY-MM-DD
  endDate: string;
  isHalfDay: boolean;
  halfDayDate?: string;     // which date is half day
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: LeaveStatus;
  currentApprovalLevel: number;  // which level is pending
  approvalChain: ApprovalStep[]; // full audit of approvals
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  approverComment?: string;
  isCompOff: boolean;            // comp-off request
  compOffDate?: string;          // the date compensating for
  createdAt: string;
  updatedAt: string;
}

/** Audit trail for every leave action */
export interface LeaveAuditLog {
  id: string;
  companyId: string;
  leaveRequestId: string;
  employeeId: string;
  action: "APPLIED" | "APPROVED" | "REJECTED" | "CANCELLED" | "BALANCE_DEDUCTED" | "BALANCE_RESTORED" | "ESCALATED" | "ENCASHED" | "ATTENDANCE_SYNCED";
  performedBy: string;
  performedByName: string;
  details: Record<string, unknown>;
  previousStatus?: LeaveStatus;
  newStatus?: LeaveStatus;
  createdAt: string;
}

export interface Holiday {
  id: string;
  companyId: string;
  name: string;
  date: string;  // YYYY-MM-DD
  isOptional: boolean;
  isRestrictedHoliday: boolean;   // employee must use leave balance
  createdAt: string;
  updatedAt: string;
}

// ─── Payroll ──────────────────────────────────────────────────
export interface PayrollRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  month: number; // 1-12
  year: number;
  basicSalary: number;
  allowances: PayrollAllowance[];
  deductions: PayrollDeduction[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: "draft" | "processed" | "paid";
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollAllowance {
  name: string;
  amount: number;
}

export interface PayrollDeduction {
  name: string;
  amount: number;
}

// ─── Notifications ────────────────────────────────────────────
export interface Notification {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  message: string;
  type: "leave" | "attendance" | "payroll" | "system" | "announcement";
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

// ─── API Response ─────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Pagination ───────────────────────────────────────────────
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ─── Employee Sessions ────────────────────────────────────────
export type SessionStatus = "ACTIVE" | "ENDED" | "EXPIRED";

export interface EmployeeSession {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  email: string;
  role: Role;
  department: string;
  status: SessionStatus;
  loginAt: string;          // ISO timestamp
  logoutAt: string | null;  // ISO timestamp
  durationMinutes: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string | null;
  os: string | null;
  createdAt: string;
}

// ─── Dashboard ────────────────────────────────────────────────
export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  pendingLeaveRequests: number;
  departmentDistribution: { department: string; count: number }[];
  attendanceWeek: { day: string; present: number; absent: number; leave: number }[];
  leaveBreakdown: {
    pending: number;
    approved: number;
    rejected: number;
    chart: { name: string; value: number; color: string }[];
  };
  payrollSummary: {
    totalThisMonth: number;
    avgSalary: number;
    trend: { month: string; amount: number }[];
  };
  employeeGrowth: { month: string; hires: number; exits: number }[];
  activityFeed: {
    id: string;
    type: "leave" | "employee" | "payroll" | "attendance" | "approval";
    message: string;
    user: string;
    time: string;
  }[];
  upcomingEvents: {
    id: string;
    type: "holiday" | "birthday" | "anniversary";
    title: string;
    date: string;
    daysAway: number;
  }[];
}

export interface EmployeeDashboardData {
  todayStatus: "Present" | "Absent" | "On Leave" | "Not Checked In";
  checkInTime: string | null;
  workingHours: string;
  leaveBalances: { type: string; used: number; total: number; color: string }[];
  recentPayslip: {
    month: string;
    netPay: number;
    status: string;
    paidDate: string;
  } | null;
  attendanceSummary: {
    present: number;
    absent: number;
    leave: number;
    halfDay: number;
    totalDays: number;
  };
}

export interface ManagerDashboardData {
  teamSize: number;
  teamPresent: number;
  teamOnLeave: number;
  pendingApprovals: {
    id: string;
    name: string;
    type: string;
    days: number;
    from: string;
    to: string;
    status: string;
  }[];
  teamMembers: {
    name: string;
    status: "present" | "leave" | "absent";
    checkIn: string;
  }[];
}
