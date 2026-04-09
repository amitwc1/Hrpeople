import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";
import { reviewLeaveSchema } from "@/lib/validations/schemas";
import { adminDb } from "@/lib/firebase/admin";

interface Params {
  params: { id: string };
}

async function getApproverInfo(uid: string): Promise<{ id: string; name: string }> {
  const snap = await adminDb
    .collection("employees")
    .where("uid", "==", uid)
    .limit(1)
    .get();
  if (!snap.empty) {
    const data = snap.docs[0].data();
    return { id: snap.docs[0].id, name: `${data.firstName} ${data.lastName}` };
  }
  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (userDoc.exists) {
    return { id: uid, name: userDoc.data()?.displayName || uid };
  }
  return { id: uid, name: uid };
}

// PATCH /api/leaves/[id]/review — approve or reject (MANAGER+)
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "MANAGER");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const parsed = reviewLeaveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const approver = await getApproverInfo(authResult.uid);
    let updated;

    if (parsed.data.status === "APPROVED") {
      updated = await LeaveService.approveLeave(
        authResult.companyId,
        params.id,
        approver.id,
        approver.name,
        parsed.data.comment,
        parsed.data.forceOverride
      );
    } else {
      updated = await LeaveService.rejectLeave(
        authResult.companyId,
        params.id,
        approver.id,
        approver.name,
        parsed.data.comment
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
