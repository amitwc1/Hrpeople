import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { PayrollService } from "@/services/payroll.service";
import { createPayrollSchema } from "@/lib/validations/schemas";
import { EmployeeService } from "@/services/employee.service";

// GET /api/payroll — get payroll records
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || authResult.uid;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;

    // Employees can only view their own
    if (authResult.role === "EMPLOYEE" && employeeId !== authResult.uid) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const records = await PayrollService.getByEmployee(authResult.companyId, employeeId, year);
    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/payroll — create payroll record (COMPANY_ADMIN+)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const parsed = createPayrollSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Fetch employee name
    const employee = await EmployeeService.getById(authResult.companyId, parsed.data.employeeId);
    const employeeName = employee
      ? `${employee.firstName} ${employee.lastName}`
      : "Unknown";

    const record = await PayrollService.create(authResult.companyId, parsed.data, employeeName);
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
