import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { NotificationService } from "@/services/notification.service";

// GET /api/notifications — get user's notifications
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const notifications = await NotificationService.getForUser(
      authResult.companyId,
      authResult.uid,
      limit
    );
    const unreadCount = await NotificationService.getUnreadCount(
      authResult.companyId,
      authResult.uid
    );

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications — mark all as read
export async function PATCH(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    await NotificationService.markAllRead(authResult.companyId, authResult.uid);
    return NextResponse.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
