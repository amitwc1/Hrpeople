import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";
import { createLeaveRequestSchema } from "@/lib/validations/schemas";
import type { LeaveStatus } from "@/types";
import { adminDb } from "@/lib/firebase/admin";

async function getEmployeeInfo(uid: string): Promise<{ id: string; name: string }> {
  const snap = await adminDb
    .collection("employees")
    .where("uid", "==", uid)
    .limit(1)
    .get();
  if (snap.empty) throw new Error("Employee record not found");
  const data = snap.docs[0].data();
  return { id: snap.docs[0].id, name: `${data.firstName} ${data.lastName}` };
}

// GET /api/leaves — list leave requests
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as LeaveStatus | null;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const filters: Parameters<typeof LeaveService.listRequests>[1] = {
      page,
      pageSize,
      status: status || undefined,
    };

    const emp = await getEmployeeInfo(authResult.uid);

    if (authResult.role === "EMPLOYEE") {
      filters.employeeId = emp.id;
    } else if (authResult.role === "MANAGER") {
      filters.managerId = emp.id;
    }

    const result = await LeaveService.listRequests(authResult.companyId, filters);

    return NextResponse.json({
      success: true,
      data: result.requests,
      total: result.total,
      page,
      pageSize,
      hasMore: page * pageSize < result.total,
      currentEmployeeId: emp.id,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/leaves — apply for leave
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const parsed = createLeaveRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const emp = await getEmployeeInfo(authResult.uid);

    const leaveRequest = await LeaveService.applyLeave(
      authResult.companyId,
      emp.id,
      emp.name,
      parsed.data
    );

    return NextResponse.json({ success: true, data: leaveRequest }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
