import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";
import { adminDb } from "@/lib/firebase/admin";

async function getEmployeeId(uid: string): Promise<string> {
  const snap = await adminDb
    .collection("employees")
    .where("uid", "==", uid)
    .limit(1)
    .get();
  if (snap.empty) throw new Error("Employee record not found");
  return snap.docs[0].id;
}

// GET /api/leaves/balance?year=2026
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const empId = await getEmployeeId(authResult.uid);

    const balances = await LeaveService.getAllBalances(
      authResult.companyId,
      empId,
      year
    );

    return NextResponse.json({ success: true, data: balances });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
