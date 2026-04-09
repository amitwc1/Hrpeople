import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";
import { adminDb } from "@/lib/firebase/admin";

// POST /api/leaves/balance/init — initialize balances for all active employees (COMPANY_ADMIN+)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;
  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json().catch(() => ({}));
    const year = body.year || new Date().getFullYear();

    // Get all active employees in the company
    const empSnap = await adminDb
      .collection("employees")
      .where("companyId", "==", authResult.companyId)
      .where("status", "==", "active")
      .get();

    if (empSnap.empty) {
      return NextResponse.json(
        { success: false, error: "No active employees found" },
        { status: 400 }
      );
    }

    let initialized = 0;
    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      await LeaveService.initializeBalances(
        authResult.companyId,
        empDoc.id,
        year,
        emp.dateOfJoining || undefined
      );
      initialized++;
    }

    return NextResponse.json({
      success: true,
      message: `Initialized leave balances for ${initialized} employees for year ${year}`,
      data: { initialized, year },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
