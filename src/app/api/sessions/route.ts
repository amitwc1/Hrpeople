import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth/middleware";
import { SessionService } from "@/services/session.service";

// GET /api/sessions — list all sessions (MANAGER+)
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleCheck = requireRole(authResult, "MANAGER");
  if (roleCheck) return roleCheck;

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "25");
    const employeeId = url.searchParams.get("employeeId") || undefined;
    const status = url.searchParams.get("status") as "ACTIVE" | "ENDED" | "EXPIRED" | undefined;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;

    const { sessions, total } = await SessionService.list(authResult.companyId, {
      page,
      pageSize,
      employeeId,
      status: status || undefined,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      data: sessions,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/sessions — start a session (called on login)
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    // End any stale active sessions for this user
    await SessionService.endActiveSessions(authResult.companyId, authResult.uid);

    const session = await SessionService.startSession({
      companyId: authResult.companyId,
      employeeId: authResult.uid,
      employeeName: body.employeeName || authResult.email,
      email: authResult.email,
      role: authResult.role,
      department: body.department || "General",
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
