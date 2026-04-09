import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { SessionService } from "@/services/session.service";

// GET /api/sessions/active — get active session count (MANAGER+)
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "MANAGER");
  if (roleCheck) return roleCheck;

  try {
    const count = await SessionService.getActiveCount(authResult.companyId);
    return NextResponse.json({ success: true, data: { activeCount: count } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
