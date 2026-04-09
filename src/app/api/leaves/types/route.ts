import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";

// GET /api/leaves/types — list leave types (any authenticated)
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const types = await LeaveService.getLeaveTypes(authResult.companyId);
    return NextResponse.json({ success: true, data: types });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/leaves/types — create leave type (COMPANY_ADMIN+)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const { name, code, isPaid, color, isActive, isCompOff, requiresAttachment, attachmentAfterDays, genderRestriction } = body;
    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: "name and code are required" },
        { status: 400 }
      );
    }
    const lt = await LeaveService.createLeaveType(authResult.companyId, {
      name,
      code,
      isPaid: isPaid ?? true,
      color: color ?? "#3b82f6",
      isActive: isActive ?? true,
      isCompOff: isCompOff ?? false,
      requiresAttachment: requiresAttachment ?? false,
      attachmentAfterDays: attachmentAfterDays ?? 0,
      ...(genderRestriction ? { genderRestriction } : {}),
    });
    return NextResponse.json({ success: true, data: lt }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

// PATCH /api/leaves/types — update leave type (COMPANY_ADMIN+)
export async function PATCH(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const { typeId, ...updates } = body;
    if (!typeId) {
      return NextResponse.json(
        { success: false, error: "typeId is required" },
        { status: 400 }
      );
    }
    const lt = await LeaveService.updateLeaveType(authResult.companyId, typeId, updates);
    return NextResponse.json({ success: true, data: lt });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

// DELETE /api/leaves/types?typeId=xxx (COMPANY_ADMIN+)
export async function DELETE(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const typeId = new URL(req.url).searchParams.get("typeId");
    if (!typeId) {
      return NextResponse.json(
        { success: false, error: "typeId is required" },
        { status: 400 }
      );
    }
    await LeaveService.deleteLeaveType(authResult.companyId, typeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
