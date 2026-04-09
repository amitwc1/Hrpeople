import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { adminDb } from "@/lib/firebase/admin";
import { registerSchema } from "@/lib/validations/schemas";

// POST /api/auth/register — register new company + admin user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, displayName, companyName } = parsed.data;

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    // Create company
    const companyRef = adminDb.collection("companies").doc();
    const companyId = companyRef.id;
    const now = new Date().toISOString();

    const company = {
      id: companyId,
      name: companyName,
      domain: email.split("@")[1],
      plan: "free",
      settings: {
        timezone: "UTC",
        dateFormat: "YYYY-MM-DD",
        workingDays: [1, 2, 3, 4, 5],
        workingHours: { start: "09:00", end: "18:00" },
        leavePolicy: { annualLeave: 21, sickLeave: 10, casualLeave: 7 },
        payrollDay: 25,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Set custom claims
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role: "COMPANY_ADMIN",
      companyId,
    });

    // Batch write company, user profile, employee record, and leave balance
    const batch = adminDb.batch();

    batch.set(companyRef, company);

    batch.set(adminDb.collection("users").doc(userRecord.uid), {
      uid: userRecord.uid,
      email,
      displayName,
      role: "COMPANY_ADMIN",
      companyId,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(adminDb.collection("employees").doc(userRecord.uid), {
      id: userRecord.uid,
      companyId,
      uid: userRecord.uid,
      employeeId: "EMP-00001",
      firstName: displayName.split(" ")[0] || displayName,
      lastName: displayName.split(" ").slice(1).join(" ") || "",
      email,
      phone: "",
      department: "Management",
      designation: "Admin",
      role: "COMPANY_ADMIN",
      dateOfJoining: now.split("T")[0],
      dateOfBirth: "",
      gender: "other",
      address: { street: "", city: "", state: "", zipCode: "", country: "" },
      emergencyContact: { name: "", relationship: "", phone: "" },
      bankDetails: { bankName: "", accountNumber: "", ifscCode: "", accountHolderName: "" },
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const year = new Date().getFullYear();
    batch.set(adminDb.collection("leaveBalances").doc(`${userRecord.uid}_${year}`), {
      id: `${userRecord.uid}_${year}`,
      companyId,
      employeeId: userRecord.uid,
      year,
      annual: { total: 21, used: 0, remaining: 21 },
      sick: { total: 10, used: 0, remaining: 10 },
      casual: { total: 7, used: 0, remaining: 7 },
      unpaid: { used: 0 },
      updatedAt: now,
    });

    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        data: {
          uid: userRecord.uid,
          companyId,
          email,
          role: "COMPANY_ADMIN",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    );
  }
}
