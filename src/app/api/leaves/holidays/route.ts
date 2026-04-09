import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";

// GET /api/leaves/holidays?year=2026 — list holidays
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const yearStr = new URL(req.url).searchParams.get("year");
    const year = yearStr ? parseInt(yearStr) : undefined;
    const holidays = await LeaveService.getHolidays(authResult.companyId, year);
    return NextResponse.json({ success: true, data: holidays });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/leaves/holidays — create holiday (COMPANY_ADMIN+)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const { name, date, isOptional } = body;
    if (!name || !date) {
      return NextResponse.json(
        { success: false, error: "name and date are required" },
        { status: 400 }
      );
    }
    const holiday = await LeaveService.createHoliday(authResult.companyId, {
      name,
      date,
      isOptional,
    });
    return NextResponse.json({ success: true, data: holiday }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

// PATCH /api/leaves/holidays — update holiday (COMPANY_ADMIN+)
export async function PATCH(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const { holidayId, ...updates } = body;
    if (!holidayId) {
      return NextResponse.json(
        { success: false, error: "holidayId is required" },
        { status: 400 }
      );
    }
    const holiday = await LeaveService.updateHoliday(
      authResult.companyId,
      holidayId,
      updates
    );
    return NextResponse.json({ success: true, data: holiday });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

// DELETE /api/leaves/holidays?holidayId=xxx (COMPANY_ADMIN+)
export async function DELETE(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const holidayId = new URL(req.url).searchParams.get("holidayId");
    if (!holidayId) {
      return NextResponse.json(
        { success: false, error: "holidayId is required" },
        { status: 400 }
      );
    }
    await LeaveService.deleteHoliday(authResult.companyId, holidayId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
