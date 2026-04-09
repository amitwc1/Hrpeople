import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";
import { adminDb } from "@/lib/firebase/admin";

interface Params {
  params: { id: string };
}

async function getEmployeeId(uid: string): Promise<string> {
  const snap = await adminDb
    .collection("employees")
    .where("uid", "==", uid)
    .limit(1)
    .get();
  if (snap.empty) throw new Error("Employee record not found");
  return snap.docs[0].id;
}

// DELETE /api/leaves/[id]/cancel — cancel leave request
export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const isAdmin =
      authResult.role === "COMPANY_ADMIN" || authResult.role === "SUPER_ADMIN";
    const empId = await getEmployeeId(authResult.uid);

    const updated = await LeaveService.cancelLeave(
      authResult.companyId,
      params.id,
      empId,
      isAdmin
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
