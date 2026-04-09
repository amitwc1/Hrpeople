import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";

const INDIAN_LEAVE_TYPES = [
  { name: "Casual Leave", code: "CL", isPaid: true, color: "#3b82f6" },
  { name: "Sick Leave", code: "SL", isPaid: true, color: "#ef4444" },
  { name: "Earned Leave", code: "EL", isPaid: true, color: "#22c55e" },
  { name: "Loss of Pay", code: "LOP", isPaid: false, color: "#6b7280" },
  { name: "Maternity Leave", code: "ML", isPaid: true, color: "#ec4899", genderRestriction: "female" as const },
  { name: "Paternity Leave", code: "PL", isPaid: true, color: "#8b5cf6", genderRestriction: "male" as const },
];

const DEFAULT_POLICIES: Record<string, { annualQuota: number; allowHalfDay: boolean; carryForward: boolean; maxCarryForwardDays: number; maxDaysPerRequest: number }> = {
  CL: { annualQuota: 12, allowHalfDay: true, carryForward: false, maxCarryForwardDays: 0, maxDaysPerRequest: 3 },
  SL: { annualQuota: 12, allowHalfDay: true, carryForward: false, maxCarryForwardDays: 0, maxDaysPerRequest: 7 },
  EL: { annualQuota: 15, allowHalfDay: false, carryForward: true, maxCarryForwardDays: 30, maxDaysPerRequest: 30 },
  LOP: { annualQuota: 365, allowHalfDay: true, carryForward: false, maxCarryForwardDays: 0, maxDaysPerRequest: 30 },
  ML: { annualQuota: 182, allowHalfDay: false, carryForward: false, maxCarryForwardDays: 0, maxDaysPerRequest: 182 },
  PL: { annualQuota: 15, allowHalfDay: false, carryForward: false, maxCarryForwardDays: 0, maxDaysPerRequest: 15 },
};

// POST /api/leaves/seed — seed default Indian leave types + policies (COMPANY_ADMIN+)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    // Check if types already exist
    const existing = await LeaveService.getLeaveTypes(authResult.companyId);
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "Leave types already exist. Delete them first to re-seed." },
        { status: 400 }
      );
    }

    const createdTypes = [];
    const createdPolicies = [];

    for (const lt of INDIAN_LEAVE_TYPES) {
      const created = await LeaveService.createLeaveType(authResult.companyId, {
        name: lt.name,
        code: lt.code,
        isPaid: lt.isPaid,
        color: lt.color,
        isActive: true,
        isCompOff: false,
        requiresAttachment: lt.code === "SL",
        attachmentAfterDays: lt.code === "SL" ? 2 : 0,
        ...(lt.genderRestriction ? { genderRestriction: lt.genderRestriction } : {}),
      });
      createdTypes.push(created);

      // Create default policy
      const defaults = DEFAULT_POLICIES[lt.code];
      if (defaults) {
        const policy = await LeaveService.createPolicy(authResult.companyId, {
          leaveTypeId: created.id,
          leaveTypeName: lt.name,
          annualQuota: defaults.annualQuota,
          monthlyAccrual: false,
          carryForward: defaults.carryForward,
          maxCarryForwardDays: defaults.maxCarryForwardDays,
          probationRestricted: lt.code !== "SL" && lt.code !== "LOP",
          probationMonths: 6,
          minDaysPerRequest: 0.5,
          maxDaysPerRequest: defaults.maxDaysPerRequest,
          sandwichPolicy: false,
          includeWeekends: false,
          includeHolidays: false,
          allowHalfDay: defaults.allowHalfDay,
          allowBackdated: true,
          maxBackdatedDays: 7,
          advanceNoticeDays: 0,
          allowNegativeBalance: lt.code === "LOP",
          maxNegativeBalance: lt.code === "LOP" ? 365 : 0,
          allowEncashment: lt.code === "EL",
          maxEncashmentDays: lt.code === "EL" ? 10 : 0,
          proRataForNewJoiners: lt.code !== "LOP",
          approvalLevels: [],
          blackoutDates: [],
          departmentQuotaPercent: 0,
          isActive: true,
        });
        createdPolicies.push(policy);
      }
    }

    return NextResponse.json({
      success: true,
      data: { types: createdTypes, policies: createdPolicies },
      message: `Seeded ${createdTypes.length} leave types and ${createdPolicies.length} policies`,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
