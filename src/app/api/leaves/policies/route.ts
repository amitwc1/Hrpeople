import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";

// GET /api/leaves/policies — list policies (any authenticated)
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const policies = await LeaveService.getPolicies(authResult.companyId);
    return NextResponse.json({ success: true, data: policies });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/leaves/policies — create policy (COMPANY_ADMIN+)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const {
      leaveTypeId,
      leaveTypeName,
      annualQuota,
      monthlyAccrual,
      carryForward,
      maxCarryForwardDays,
      probationRestricted,
      minDaysPerRequest,
      maxDaysPerRequest,
      sandwichPolicy,
      includeWeekends,
      includeHolidays,
      allowHalfDay,
      allowBackdated,
      maxBackdatedDays,
      isActive,
      probationMonths,
      advanceNoticeDays,
      allowNegativeBalance,
      maxNegativeBalance,
      allowEncashment,
      maxEncashmentDays,
      proRataForNewJoiners,
      approvalLevels,
      blackoutDates,
      departmentQuotaPercent,
    } = body;

    if (!leaveTypeId || annualQuota == null) {
      return NextResponse.json(
        { success: false, error: "leaveTypeId and annualQuota are required" },
        { status: 400 }
      );
    }

    const policy = await LeaveService.createPolicy(authResult.companyId, {
      leaveTypeId,
      leaveTypeName: leaveTypeName || "",
      annualQuota,
      monthlyAccrual: monthlyAccrual ?? false,
      carryForward: carryForward ?? false,
      maxCarryForwardDays: maxCarryForwardDays ?? 0,
      probationRestricted: probationRestricted ?? false,
      minDaysPerRequest: minDaysPerRequest ?? 0.5,
      maxDaysPerRequest: maxDaysPerRequest ?? 30,
      sandwichPolicy: sandwichPolicy ?? false,
      includeWeekends: includeWeekends ?? false,
      includeHolidays: includeHolidays ?? false,
      allowHalfDay: allowHalfDay ?? true,
      allowBackdated: allowBackdated ?? false,
      maxBackdatedDays: maxBackdatedDays ?? 0,
      isActive: isActive ?? true,
      probationMonths: probationMonths ?? 6,
      advanceNoticeDays: advanceNoticeDays ?? 0,
      allowNegativeBalance: allowNegativeBalance ?? false,
      maxNegativeBalance: maxNegativeBalance ?? 0,
      allowEncashment: allowEncashment ?? false,
      maxEncashmentDays: maxEncashmentDays ?? 0,
      proRataForNewJoiners: proRataForNewJoiners ?? false,
      approvalLevels: approvalLevels ?? [],
      blackoutDates: blackoutDates ?? [],
      departmentQuotaPercent: departmentQuotaPercent ?? 0,
    });

    return NextResponse.json({ success: true, data: policy }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

// PATCH /api/leaves/policies — update policy (COMPANY_ADMIN+)
export async function PATCH(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const { policyId, ...updates } = body;
    if (!policyId) {
      return NextResponse.json(
        { success: false, error: "policyId is required" },
        { status: 400 }
      );
    }
    const policy = await LeaveService.updatePolicy(
      authResult.companyId,
      policyId,
      updates
    );
    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

// DELETE /api/leaves/policies?policyId=xxx (COMPANY_ADMIN+)
export async function DELETE(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const policyId = new URL(req.url).searchParams.get("policyId");
    if (!policyId) {
      return NextResponse.json(
        { success: false, error: "policyId is required" },
        { status: 400 }
      );
    }
    await LeaveService.deletePolicy(authResult.companyId, policyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
