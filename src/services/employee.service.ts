import { adminDb } from "@/lib/firebase/admin";
import { adminAuth } from "@/lib/firebase/admin";
import type { Employee, PaginationParams } from "@/types";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/lib/validations/schemas";

const COLLECTION = "employees";

function generateEmployeeId(): string {
  const num = Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, "0");
  return `EMP-${num}`;
}

export class EmployeeService {
  // ─── Create ───────────────────────────────────────────────
  static async create(
    companyId: string,
    data: CreateEmployeeInput
  ): Promise<Employee> {
    // Create Firebase Auth user with password so they can sign in
    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: data.password,
      displayName: `${data.firstName} ${data.lastName}`,
    });

    // Set custom claims for RBAC
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role: data.role,
      companyId,
    });

    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...employeeData } = data;
    const employee: Employee = {
      id: userRecord.uid,
      companyId,
      uid: userRecord.uid,
      employeeId: generateEmployeeId(),
      ...employeeData,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const batch = adminDb.batch();

    // Write employee document
    batch.set(adminDb.collection(COLLECTION).doc(employee.id), employee);

    // Write user profile
    batch.set(adminDb.collection("users").doc(userRecord.uid), {
      uid: userRecord.uid,
      email: data.email,
      displayName: `${data.firstName} ${data.lastName}`,
      role: data.role,
      companyId,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();

    // Initialize leave balances from active policies
    const { LeaveService } = await import("@/services/leave.service");
    await LeaveService.initializeBalances(companyId, userRecord.uid, new Date().getFullYear()).catch(() => {
      // Non-fatal: balances can be initialized later
    });

    return employee;
  }

  // ─── Get by ID ────────────────────────────────────────────
  static async getById(
    companyId: string,
    employeeId: string
  ): Promise<Employee | null> {
    const doc = await adminDb.collection(COLLECTION).doc(employeeId).get();
    if (!doc.exists) return null;
    const employee = doc.data() as Employee;
    // Enforce tenant isolation
    if (employee.companyId !== companyId) return null;
    return employee;
  }

  // ─── List ─────────────────────────────────────────────────
  static async list(
    companyId: string,
    params: PaginationParams & { department?: string; status?: string } = {}
  ): Promise<{ employees: Employee[]; total: number }> {
    const { page = 1, pageSize = 20, sortBy = "createdAt", sortOrder = "desc", department, status } = params;

    let query: FirebaseFirestore.Query = adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId);

    if (department) {
      query = query.where("department", "==", department);
    }
    if (status) {
      query = query.where("status", "==", status);
    }

    // Fetch all matching docs and sort/paginate in-memory
    // (avoids needing composite Firestore indexes for orderBy)
    const snapshot = await query.get();
    const allEmployees = snapshot.docs.map((doc) => doc.data() as Employee);

    // Sort
    allEmployees.sort((a, b) => {
      const aVal = String((a as unknown as Record<string, unknown>)[sortBy] || "");
      const bVal = String((b as unknown as Record<string, unknown>)[sortBy] || "");
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

    const total = allEmployees.length;
    const offset = (page - 1) * pageSize;
    const employees = allEmployees.slice(offset, offset + pageSize);

    return { employees, total };
  }

  // ─── Update ───────────────────────────────────────────────
  static async update(
    companyId: string,
    employeeId: string,
    data: UpdateEmployeeInput
  ): Promise<Employee | null> {
    const existing = await this.getById(companyId, employeeId);
    if (!existing) return null;

    const updated = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection(COLLECTION).doc(employeeId).update(updated);

    // If role changed, update custom claims
    if (data.role && data.role !== existing.role) {
      await adminAuth.setCustomUserClaims(existing.uid, {
        role: data.role,
        companyId,
      });
    }

    return { ...existing, ...updated } as Employee;
  }

  // ─── Delete (soft) ────────────────────────────────────────
  static async deactivate(companyId: string, employeeId: string): Promise<boolean> {
    const existing = await this.getById(companyId, employeeId);
    if (!existing) return false;

    await adminDb.collection(COLLECTION).doc(employeeId).update({
      status: "inactive",
      updatedAt: new Date().toISOString(),
    });

    // Disable auth account
    await adminAuth.updateUser(existing.uid, { disabled: true });
    return true;
  }

  // ─── Get by Manager ───────────────────────────────────────
  static async getByManager(
    companyId: string,
    managerId: string
  ): Promise<Employee[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("managerId", "==", managerId)
      .where("status", "==", "active")
      .get();

    return snapshot.docs.map((doc) => doc.data() as Employee);
  }

  // ─── Department Stats ─────────────────────────────────────
  static async getDepartmentStats(
    companyId: string
  ): Promise<{ department: string; count: number }[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("status", "==", "active")
      .get();

    const deptMap = new Map<string, number>();
    snapshot.docs.forEach((doc) => {
      const emp = doc.data() as Employee;
      deptMap.set(emp.department, (deptMap.get(emp.department) || 0) + 1);
    });

    return Array.from(deptMap.entries()).map(([department, count]) => ({
      department,
      count,
    }));
  }
}
