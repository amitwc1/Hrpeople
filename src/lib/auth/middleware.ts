import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import type { Role, CustomClaims } from "@/types";

const ROLE_LEVEL: Record<Role, number> = {
  SUPER_ADMIN: 4,
  COMPANY_ADMIN: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
};

export interface AuthenticatedRequest {
  uid: string;
  email: string;
  role: Role;
  companyId: string;
}

export async function authenticateRequest(
  req: NextRequest
): Promise<AuthenticatedRequest | NextResponse> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const claims = decoded as typeof decoded & Partial<CustomClaims>;

    if (!claims.role || !claims.companyId) {
      // Fallback: read from Firestore users collection
      const { adminDb } = await import("@/lib/firebase/admin");
      const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
      if (!userDoc.exists) {
        return NextResponse.json(
          { success: false, error: "User profile not found" },
          { status: 403 }
        );
      }
      const userData = userDoc.data()!;
      return {
        uid: decoded.uid,
        email: decoded.email || "",
        role: userData.role as Role,
        companyId: userData.companyId as string,
      };
    }

    return {
      uid: decoded.uid,
      email: decoded.email || "",
      role: claims.role,
      companyId: claims.companyId,
    };
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}

export function requireRole(authUser: AuthenticatedRequest, requiredRole: Role): NextResponse | null {
  if (ROLE_LEVEL[authUser.role] < ROLE_LEVEL[requiredRole]) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }
  return null;
}

export function requireCompanyAccess(
  authUser: AuthenticatedRequest,
  companyId: string
): NextResponse | null {
  if (authUser.role === "SUPER_ADMIN") return null;
  if (authUser.companyId !== companyId) {
    return NextResponse.json(
      { success: false, error: "Access denied to this company's data" },
      { status: 403 }
    );
  }
  return null;
}
