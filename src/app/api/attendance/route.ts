import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { AttendanceService } from "@/services/attendance.service";
import { checkInSchema, checkOutSchema } from "@/lib/validations/schemas";
import { adminDb } from "@/lib/firebase/admin";

/** Resolve employee name from uid */
async function getEmployeeName(uid: string): Promise<string> {
  const snap = await adminDb
    .collection("employees")
    .where("uid", "==", uid)
    .limit(1)
    .get();
  if (snap.empty) return "Unknown";
  const data = snap.docs[0].data();
  return `${data.firstName} ${data.lastName}`;
}

/** Resolve employee ID (doc id) from uid */
async function getEmployeeId(uid: string): Promise<string> {
  const snap = await adminDb
    .collection("employees")
    .where("uid", "==", uid)
    .limit(1)
    .get();
  if (snap.empty) throw new Error("Employee record not found");
  return snap.docs[0].id;
}

// GET /api/attendance — get today's attendance or history
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const employeeId = await getEmployeeId(authResult.uid);

    if (startDate && endDate) {
      const records = await AttendanceService.getHistory(
        authResult.companyId,
        employeeId,
        startDate,
        endDate
      );
      return NextResponse.json({ success: true, data: records });
    }

    const today = await AttendanceService.getToday(authResult.companyId, employeeId);
    return NextResponse.json({ success: true, data: today });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/attendance — clock in
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = checkInSchema.safeParse(body);
    const employeeId = await getEmployeeId(authResult.uid);
    const employeeName = await getEmployeeName(authResult.uid);

    const record = await AttendanceService.clockIn(
      authResult.companyId,
      employeeId,
      employeeName,
      {
        notes: parsed.success ? parsed.data.notes : undefined,
        location: body?.location,
        deviceInfo: body?.deviceInfo,
      }
    );

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

// PATCH /api/attendance — clock out
export async function PATCH(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = checkOutSchema.safeParse(body);
    const employeeId = await getEmployeeId(authResult.uid);

    const record = await AttendanceService.clockOut(
      authResult.companyId,
      employeeId,
      {
        notes: parsed.success ? parsed.data.notes : undefined,
        location: body?.location,
      }
    );

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
