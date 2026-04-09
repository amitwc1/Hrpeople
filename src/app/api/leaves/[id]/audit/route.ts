import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { LeaveService } from "@/services/leave.service";

interface Params {
  params: { id: string };
}

// GET /api/leaves/[id]/audit — get audit logs for a leave request
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const logs = await LeaveService.getAuditLogs(params.id);
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
