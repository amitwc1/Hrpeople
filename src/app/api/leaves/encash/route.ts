import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";
import { adminDb } from "@/lib/firebase/admin";
import { z } from "zod";

const encashSchema = z.object({
  employeeId: z.string().min(1, "Employee ID required"),
  leaveTypeId: z.string().min(1, "Leave type required"),
  year: z.number().min(2020).max(2100),
  days: z.number().min(0.5, "Minimum 0.5 days"),
});

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
  return { id: uid, name: uid };
}

// POST /api/leaves/encash — encash leave balance (COMPANY_ADMIN+)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const parsed = encashSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const approver = await getApproverInfo(authResult.uid);

    const balance = await LeaveService.encashLeave(
      authResult.companyId,
      parsed.data.employeeId,
      parsed.data.leaveTypeId,
      parsed.data.year,
      parsed.data.days,
      approver.id,
      approver.name
    );

    return NextResponse.json({ success: true, data: balance });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
