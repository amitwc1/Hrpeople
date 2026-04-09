import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { EmployeeService } from "@/services/employee.service";
import { updateEmployeeSchema } from "@/lib/validations/schemas";

interface Params {
  params: { id: string };
}

// GET /api/employees/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const employee = await EmployeeService.getById(authResult.companyId, params.id);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/employees/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const parsed = updateEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const employee = await EmployeeService.update(authResult.companyId, params.id, parsed.data);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/[id] — soft delete (deactivate)
export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const success = await EmployeeService.deactivate(authResult.companyId, params.id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, message: "Employee deactivated" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
