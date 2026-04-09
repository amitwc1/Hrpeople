import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { SessionService } from "@/services/session.service";

// POST /api/sessions/end — end the current active session (called on logout)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const sessionId = body.sessionId;

    if (sessionId) {
      await SessionService.endSession(sessionId);
    } else {
      // End all active sessions for this user
      await SessionService.endActiveSessions(authResult.companyId, authResult.uid);
    }

    return NextResponse.json({ success: true, message: "Session ended" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
