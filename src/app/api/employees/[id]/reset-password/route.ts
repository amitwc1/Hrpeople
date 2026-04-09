import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { adminAuth } from "@/lib/firebase/admin";
import { z } from "zod";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

interface Params {
  params: { id: string };
}

// PATCH /api/employees/[id]/reset-password
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "COMPANY_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify the employee belongs to the same company
    const { adminDb } = await import("@/lib/firebase/admin");
    const empDoc = await adminDb.collection("employees").doc(params.id).get();
    if (!empDoc.exists || empDoc.data()?.companyId !== authResult.companyId) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }

    await adminAuth.updateUser(params.id, {
      password: parsed.data.newPassword,
    });

    return NextResponse.json({ success: true, data: { message: "Password reset successfully" } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to reset password" },
      { status: 500 }
    );
  }
}
