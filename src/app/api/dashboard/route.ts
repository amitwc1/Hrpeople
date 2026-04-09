import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { EmployeeService } from "@/services/employee.service";
import { AttendanceService } from "@/services/attendance.service";
import { LeaveService } from "@/services/leave.service";
import { PayrollService } from "@/services/payroll.service";
import type { DashboardStats, EmployeeDashboardData, ManagerDashboardData } from "@/types";

function toISO(d: Date) {
  return d.toISOString().split("T")[0];
}

function formatDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h ${m}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// GET /api/dashboard — dashboard stats
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { companyId, uid, role } = authResult;
    const today = toISO(new Date());

    // ── Employee-specific dashboard ──
    if (role === "EMPLOYEE") {
      const data = await buildEmployeeDashboard(companyId, uid);
      return NextResponse.json({ success: true, data });
    }

    // ── Manager-specific dashboard ──
    if (role === "MANAGER") {
      const data = await buildManagerDashboard(companyId, uid, today);
      return NextResponse.json({ success: true, data });
    }

    // ── Admin dashboard ──
    const data = await buildAdminDashboard(companyId, today);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Admin Dashboard ─────────────────────────────────────────
async function buildAdminDashboard(companyId: string, today: string): Promise<DashboardStats> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const [
    employeeResult,
    attendanceStats,
    pendingLeaves,
    deptStats,
    weekAttendance,
    leaveData,
    payrollData,
    growthData,
    activityData,
    eventsData,
  ] = await Promise.all([
    EmployeeService.list(companyId, { status: "active", pageSize: 1 }),
    AttendanceService.getCompanyStats(companyId),
    LeaveService.getPendingCount(companyId),
    EmployeeService.getDepartmentStats(companyId),
    getWeekAttendance(companyId, now),
    getLeaveBreakdown(companyId, currentYear, currentMonth),
    getPayrollSummary(companyId, currentYear, currentMonth),
    getEmployeeGrowth(companyId, currentYear),
    getActivityFeed(companyId),
    getUpcomingEvents(companyId, today),
  ]);

  return {
    totalEmployees: employeeResult.total,
    presentToday: attendanceStats.present,
    onLeaveToday: attendanceStats.onLeave,
    pendingLeaveRequests: pendingLeaves,
    departmentDistribution: deptStats,
    attendanceWeek: weekAttendance,
    leaveBreakdown: leaveData,
    payrollSummary: payrollData,
    employeeGrowth: growthData,
    activityFeed: activityData,
    upcomingEvents: eventsData,
  };
}

// ─── Week Attendance (last 5 workdays) ───────────────────────
async function getWeekAttendance(companyId: string, now: Date) {
  const days: { day: string; present: number; absent: number; leave: number }[] = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = toISO(d);
    const stats = await AttendanceService.getCompanyStats(companyId, dateStr);
    days.push({
      day: DAY_LABELS[d.getDay()],
      present: stats.present,
      absent: stats.absent,
      leave: stats.onLeave,
    });
  }
  return days;
}

// ─── Leave Breakdown ─────────────────────────────────────────
async function getLeaveBreakdown(companyId: string, year: number, month: number) {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

  const { requests } = await LeaveService.listRequests(companyId, {
    startDate,
    endDate,
    pageSize: 500,
  });

  let pending = 0, approved = 0, rejected = 0;
  const typeMap = new Map<string, { name: string; value: number; color: string }>();

  // Get leave types for colors
  const leaveTypes = await LeaveService.getLeaveTypes(companyId);
  const colorMap = new Map(leaveTypes.map((t) => [t.id, { name: t.name, color: t.color }]));

  for (const r of requests) {
    if (r.status === "PENDING" || r.status === "PENDING_L2" || r.status === "PENDING_L3") pending++;
    else if (r.status === "APPROVED") approved++;
    else if (r.status === "REJECTED") rejected++;

    const typeInfo = colorMap.get(r.leaveTypeId) || { name: r.leaveTypeName, color: "#8b5cf6" };
    const existing = typeMap.get(r.leaveTypeId);
    if (existing) {
      existing.value += r.totalDays;
    } else {
      typeMap.set(r.leaveTypeId, { name: typeInfo.name, value: r.totalDays, color: typeInfo.color });
    }
  }

  return {
    pending,
    approved,
    rejected,
    chart: Array.from(typeMap.values()),
  };
}

// ─── Payroll Summary (last 6 months) ─────────────────────────
async function getPayrollSummary(companyId: string, year: number, month: number) {
  const trend: { month: string; amount: number }[] = [];
  let totalThisMonth = 0;
  let totalCount = 0;

  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m < 0) { m += 12; y--; }
    const records = await PayrollService.getMonthlyPayroll(companyId, m + 1, y);
    const total = records.reduce((sum, r) => sum + r.netPay, 0);
    trend.push({ month: MONTH_LABELS[m], amount: total });
    if (i === 0) {
      totalThisMonth = total;
      totalCount = records.length;
    }
  }

  return {
    totalThisMonth,
    avgSalary: totalCount > 0 ? Math.round(totalThisMonth / totalCount) : 0,
    trend,
  };
}

// ─── Employee Growth (last 10 months) ────────────────────────
async function getEmployeeGrowth(companyId: string, year: number) {
  const now = new Date();
  const growth: { month: string; hires: number; exits: number }[] = [];

  // Fetch all employees (active + inactive) for growth data
  const allActive = await EmployeeService.list(companyId, { status: "active", pageSize: 1000 });
  const allInactive = await EmployeeService.list(companyId, { status: "inactive", pageSize: 1000 });
  const allTerminated = await EmployeeService.list(companyId, { status: "terminated", pageSize: 1000 });
  const allEmployees = [
    ...allActive.employees,
    ...allInactive.employees,
    ...allTerminated.employees,
  ];

  for (let i = 9; i >= 0; i--) {
    const d = new Date(year, now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const label = MONTH_LABELS[m];

    const hires = allEmployees.filter((e) => {
      const created = new Date(e.createdAt);
      return created.getFullYear() === y && created.getMonth() === m;
    }).length;

    const exits = allEmployees.filter((e) => {
      if (e.status !== "terminated" && e.status !== "inactive") return false;
      const updated = new Date(e.updatedAt);
      return updated.getFullYear() === y && updated.getMonth() === m;
    }).length;

    growth.push({ month: label, hires, exits });
  }

  return growth;
}

// ─── Activity Feed ───────────────────────────────────────────
async function getActivityFeed(companyId: string) {
  // Fetch recent leave requests, new employees, recent payroll in parallel
  const [leaveResult, empResult] = await Promise.all([
    LeaveService.listRequests(companyId, { pageSize: 10 }),
    EmployeeService.list(companyId, { pageSize: 10 }),
  ]);

  type ActivityItem = DashboardStats["activityFeed"][number];
  const activities: ActivityItem[] = [];

  for (const r of leaveResult.requests.slice(0, 5)) {
    const typeLabel = r.status === "APPROVED" ? "approval" : r.status === "REJECTED" ? "leave" : "leave";
    const msg =
      r.status === "APPROVED" ? `${r.leaveTypeName} approved` :
      r.status === "REJECTED" ? `${r.leaveTypeName} rejected` :
      `Applied for ${r.totalDays}d ${r.leaveTypeName}`;
    activities.push({
      id: r.id,
      type: typeLabel,
      message: msg,
      user: r.employeeName,
      time: timeAgo(r.createdAt),
    });
  }

  for (const e of empResult.employees.slice(0, 3)) {
    activities.push({
      id: e.id,
      type: "employee",
      message: "New employee onboarded",
      user: `${e.firstName} ${e.lastName}`,
      time: timeAgo(e.createdAt),
    });
  }

  // Sort by most recent (approximate by the timeAgo strings won't work, use raw dates)
  // We'll re-sort by createdAt timestamps
  const withTime = [
    ...leaveResult.requests.slice(0, 5).map((r) => ({
      item: activities.find((a) => a.id === r.id)!,
      ts: new Date(r.createdAt).getTime(),
    })),
    ...empResult.employees.slice(0, 3).map((e) => ({
      item: activities.find((a) => a.id === e.id)!,
      ts: new Date(e.createdAt).getTime(),
    })),
  ];

  withTime.sort((a, b) => b.ts - a.ts);
  return withTime.map((w) => w.item).slice(0, 8);
}

// ─── Upcoming Events ─────────────────────────────────────────
async function getUpcomingEvents(companyId: string, today: string) {
  const todayDate = new Date(today);
  type EventItem = DashboardStats["upcomingEvents"][number];
  const events: EventItem[] = [];

  // Holidays
  try {
    const holidays = await LeaveService.getHolidays(companyId, todayDate.getFullYear());
    for (const h of holidays) {
      const hDate = new Date(h.date);
      const diff = Math.ceil((hDate.getTime() - todayDate.getTime()) / 86400000);
      if (diff >= 0 && diff <= 30) {
        events.push({
          id: h.id,
          type: "holiday",
          title: h.name,
          date: h.date,
          daysAway: diff,
        });
      }
    }
  } catch { /* holidays collection may not exist yet */ }

  // Birthdays & anniversaries
  try {
    const { employees } = await EmployeeService.list(companyId, { status: "active", pageSize: 500 });

    for (const emp of employees) {
      if (emp.dateOfBirth) {
        const dob = new Date(emp.dateOfBirth);
        const bday = new Date(todayDate.getFullYear(), dob.getMonth(), dob.getDate());
        const diff = Math.ceil((bday.getTime() - todayDate.getTime()) / 86400000);
        if (diff >= 0 && diff <= 30) {
          events.push({
            id: `bday-${emp.id}`,
            type: "birthday",
            title: `${emp.firstName} ${emp.lastName}`,
            date: toISO(bday),
            daysAway: diff,
          });
        }
      }
      if (emp.dateOfJoining) {
        const doj = new Date(emp.dateOfJoining);
        const anniv = new Date(todayDate.getFullYear(), doj.getMonth(), doj.getDate());
        const yearsWorked = todayDate.getFullYear() - doj.getFullYear();
        if (yearsWorked > 0) {
          const diff = Math.ceil((anniv.getTime() - todayDate.getTime()) / 86400000);
          if (diff >= 0 && diff <= 30) {
            events.push({
              id: `anniv-${emp.id}`,
              type: "anniversary",
              title: `${emp.firstName} (${yearsWorked} yr${yearsWorked > 1 ? "s" : ""})`,
              date: toISO(anniv),
              daysAway: diff,
            });
          }
        }
      }
    }
  } catch { /* ignore */ }

  events.sort((a, b) => a.daysAway - b.daysAway);
  return events.slice(0, 8);
}

// ─── Employee Dashboard ──────────────────────────────────────
async function buildEmployeeDashboard(companyId: string, uid: string): Promise<EmployeeDashboardData> {
  // Find the employee record by uid
  const { employees } = await EmployeeService.list(companyId, { status: "active", pageSize: 500 });
  const employee = employees.find((e) => e.uid === uid);
  if (!employee) {
    return {
      todayStatus: "Not Checked In",
      checkInTime: null,
      workingHours: "0h 0m",
      leaveBalances: [],
      recentPayslip: null,
      attendanceSummary: { present: 0, absent: 0, leave: 0, halfDay: 0, totalDays: 0 },
    };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

  const [todayRecord, balances, monthRecords, payslips] = await Promise.all([
    AttendanceService.getToday(companyId, employee.id),
    LeaveService.getAllBalances(companyId, employee.id, year),
    AttendanceService.getHistory(companyId, employee.id, firstOfMonth, lastOfMonth),
    PayrollService.getByEmployee(companyId, employee.id, year),
  ]);

  // Today status
  let todayStatus: EmployeeDashboardData["todayStatus"] = "Not Checked In";
  let checkInTime: string | null = null;
  let workingHours = "0h 0m";

  if (todayRecord) {
    if (todayRecord.status === "ON_LEAVE") todayStatus = "On Leave";
    else if (todayRecord.status === "PRESENT" || todayRecord.status === "LATE" || todayRecord.status === "HALF_DAY") {
      todayStatus = "Present";
      checkInTime = todayRecord.checkIn
        ? new Date(todayRecord.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : null;
      workingHours = formatDuration(todayRecord.totalWorkingHours * 60);
    } else if (todayRecord.status === "ABSENT") {
      todayStatus = "Absent";
    }
  }

  // Leave balances
  const leaveTypes = await LeaveService.getLeaveTypes(companyId);
  const colorMap = new Map(leaveTypes.map((t) => [t.id, t.color]));
  const leaveBalances = balances.map((b) => ({
    type: b.leaveTypeName,
    used: b.used,
    total: b.totalAllocated,
    color: colorMap.get(b.leaveTypeId) || "#3b82f6",
  }));

  // Recent payslip
  let recentPayslip: EmployeeDashboardData["recentPayslip"] = null;
  if (payslips.length > 0) {
    const latest = payslips.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    })[0];
    recentPayslip = {
      month: `${MONTH_LABELS[latest.month - 1]} ${latest.year}`,
      netPay: latest.netPay,
      status: latest.status === "paid" ? "Paid" : latest.status === "processed" ? "Processed" : "Draft",
      paidDate: latest.paidAt || latest.updatedAt,
    };
  }

  // Attendance summary this month
  let present = 0, absent = 0, leave = 0, halfDay = 0;
  for (const r of monthRecords) {
    if (r.status === "PRESENT" || r.status === "LATE") present++;
    else if (r.status === "ABSENT") absent++;
    else if (r.status === "ON_LEAVE") leave++;
    else if (r.status === "HALF_DAY") halfDay++;
  }

  return {
    todayStatus,
    checkInTime,
    workingHours,
    leaveBalances,
    recentPayslip,
    attendanceSummary: {
      present,
      absent,
      leave,
      halfDay,
      totalDays: new Date(year, month + 1, 0).getDate(),
    },
  };
}

// ─── Manager Dashboard ───────────────────────────────────────
async function buildManagerDashboard(companyId: string, uid: string, today: string): Promise<ManagerDashboardData> {
  const { employees: allEmps } = await EmployeeService.list(companyId, { status: "active", pageSize: 500 });
  const manager = allEmps.find((e) => e.uid === uid);
  if (!manager) {
    return { teamSize: 0, teamPresent: 0, teamOnLeave: 0, pendingApprovals: [], teamMembers: [] };
  }

  const team = await EmployeeService.getByManager(companyId, manager.id);
  const teamSize = team.length;

  // Get team attendance for today
  const companyAttendance = await AttendanceService.getCompanyAttendance(companyId, today);
  const teamIds = new Set(team.map((t) => t.id));
  const teamAttendanceMap = new Map(
    companyAttendance.filter((a) => teamIds.has(a.employeeId)).map((a) => [a.employeeId, a])
  );

  let teamPresent = 0, teamOnLeave = 0;
  const teamMembers: ManagerDashboardData["teamMembers"] = [];

  for (const member of team) {
    const att = teamAttendanceMap.get(member.id);
    let status: "present" | "leave" | "absent" = "absent";
    let checkIn = "—";
    if (att) {
      if (att.status === "PRESENT" || att.status === "LATE" || att.status === "HALF_DAY") {
        status = "present";
        teamPresent++;
        checkIn = att.checkIn
          ? new Date(att.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
          : "—";
      } else if (att.status === "ON_LEAVE") {
        status = "leave";
        teamOnLeave++;
      }
    }
    teamMembers.push({ name: `${member.firstName} ${member.lastName}`, status, checkIn });
  }

  // Pending leave approvals for this manager's team
  const { requests } = await LeaveService.listRequests(companyId, {
    managerId: manager.id,
    status: "PENDING",
    pageSize: 10,
  });

  const pendingApprovals = requests.map((r) => ({
    id: r.id,
    name: r.employeeName,
    type: r.leaveTypeName,
    days: r.totalDays,
    from: r.startDate,
    to: r.endDate,
    status: r.status,
  }));

  return { teamSize, teamPresent, teamOnLeave, pendingApprovals, teamMembers };
}
