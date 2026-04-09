import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { EmployeeService } from "@/services/employee.service";
import { createEmployeeSchema } from "@/lib/validations/schemas";

// GET /api/employees — list employees for the authenticated user's company
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const department = searchParams.get("department") || undefined;
    const status = searchParams.get("status") || undefined;
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

    const result = await EmployeeService.list(authResult.companyId, {
      page,
      pageSize,
      department,
      status,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: result.employees,
      total: result.total,
      page,
      pageSize,
      hasMore: page * pageSize < result.total,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/employees — create a new employee (COMPANY_ADMIN+)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const parsed = createEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const employee = await EmployeeService.create(authResult.companyId, parsed.data);
    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
