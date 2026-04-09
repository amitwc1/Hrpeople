import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { AttendanceService } from "@/services/attendance.service";

// GET /api/attendance/shifts — list shifts (any authenticated)
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const shifts = await AttendanceService.getShifts(authResult.companyId);
    return NextResponse.json({ success: true, data: shifts });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/attendance/shifts — create shift (COMPANY_ADMIN+)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const { name, startTime, endTime, graceMinutes, workingHours, isDefault } = body;

    if (!name || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: "name, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    const shift = await AttendanceService.createShift(authResult.companyId, {
      name,
      startTime,
      endTime,
      graceMinutes: graceMinutes ?? 15,
      workingHours: workingHours ?? 8,
      isDefault: isDefault ?? false,
    });

    return NextResponse.json({ success: true, data: shift }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

// PATCH /api/attendance/shifts — update shift (COMPANY_ADMIN+)
export async function PATCH(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const { shiftId, ...updates } = body;

    if (!shiftId) {
      return NextResponse.json(
        { success: false, error: "shiftId is required" },
        { status: 400 }
      );
    }

    const shift = await AttendanceService.updateShift(
      authResult.companyId,
      shiftId,
      updates
    );
    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

// DELETE /api/attendance/shifts — delete shift (COMPANY_ADMIN+)
export async function DELETE(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const { searchParams } = new URL(req.url);
    const shiftId = searchParams.get("shiftId");

    if (!shiftId) {
      return NextResponse.json(
        { success: false, error: "shiftId is required" },
        { status: 400 }
      );
    }

    await AttendanceService.deleteShift(authResult.companyId, shiftId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
