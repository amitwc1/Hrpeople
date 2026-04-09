import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";

// GET /api/leaves/team-calendar?year=2025&month=6&department=Engineering
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "MANAGER");
  if (roleCheck) return roleCheck;

  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());
    const department = searchParams.get("department") || undefined;

    const entries = await LeaveService.getTeamCalendar(
      authResult.companyId,
      year,
      month,
      department
    );

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
