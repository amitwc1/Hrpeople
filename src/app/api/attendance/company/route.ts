import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { AttendanceService } from "@/services/attendance.service";

// GET /api/attendance/company — company-wide attendance data (MANAGER+)
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "MANAGER");
  if (roleCheck) return roleCheck;

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const view = searchParams.get("view"); // "stats" | "records"

    if (view === "records") {
      const records = await AttendanceService.getCompanyAttendance(
        authResult.companyId,
        date
      );
      return NextResponse.json({ success: true, data: records });
    }

    const stats = await AttendanceService.getCompanyStats(
      authResult.companyId,
      date
    );
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/attendance/company — admin correction (COMPANY_ADMIN+)
export async function PATCH(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const { attendanceId, checkIn, checkOut, status, notes } = body;

    if (!attendanceId) {
      return NextResponse.json(
        { success: false, error: "attendanceId is required" },
        { status: 400 }
      );
    }

    const record = await AttendanceService.adminUpdate(
      authResult.companyId,
      attendanceId,
      authResult.uid,
      { checkIn, checkOut, status, notes }
    );

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
