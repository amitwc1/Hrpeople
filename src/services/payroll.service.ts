import { adminDb } from "@/lib/firebase/admin";
import type { PayrollRecord } from "@/types";
import type { CreatePayrollInput } from "@/lib/validations/schemas";

const COLLECTION = "payroll";

export class PayrollService {
  static async create(
    companyId: string,
    data: CreatePayrollInput,
    employeeName: string
  ): Promise<PayrollRecord> {
    const totalAllowances = data.allowances.reduce((sum, a) => sum + a.amount, 0);
    const totalDeductions = data.deductions.reduce((sum, d) => sum + d.amount, 0);
    const grossPay = data.basicSalary + totalAllowances;
    const netPay = grossPay - totalDeductions;

    const docRef = adminDb.collection(COLLECTION).doc();
    const now = new Date().toISOString();

    const record: PayrollRecord = {
      id: docRef.id,
      companyId,
      employeeId: data.employeeId,
      employeeName,
      month: data.month,
      year: data.year,
      basicSalary: data.basicSalary,
      allowances: data.allowances,
      deductions: data.deductions,
      grossPay,
      totalDeductions,
      netPay,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(record);
    return record;
  }

  static async getByEmployee(
    companyId: string,
    employeeId: string,
    year?: number
  ): Promise<PayrollRecord[]> {
    let query = adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("employeeId", "==", employeeId);

    if (year) {
      query = query.where("year", "==", year);
    }

    const snapshot = await query.orderBy("year", "desc").orderBy("month", "desc").get();
    return snapshot.docs.map((d) => d.data() as PayrollRecord);
  }

  static async processPayroll(
    companyId: string,
    payrollId: string
  ): Promise<PayrollRecord> {
    const docRef = adminDb.collection(COLLECTION).doc(payrollId);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Payroll record not found");
    const record = doc.data() as PayrollRecord;
    if (record.companyId !== companyId) throw new Error("Access denied");
    if (record.status !== "draft") throw new Error("Only draft payrolls can be processed");

    await docRef.update({
      status: "processed",
      updatedAt: new Date().toISOString(),
    });

    return { ...record, status: "processed" };
  }

  static async markPaid(
    companyId: string,
    payrollId: string
  ): Promise<PayrollRecord> {
    const docRef = adminDb.collection(COLLECTION).doc(payrollId);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Payroll record not found");
    const record = doc.data() as PayrollRecord;
    if (record.companyId !== companyId) throw new Error("Access denied");
    if (record.status !== "processed") throw new Error("Payroll must be processed first");

    const now = new Date().toISOString();
    await docRef.update({
      status: "paid",
      paidAt: now,
      updatedAt: now,
    });

    return { ...record, status: "paid", paidAt: now };
  }

  static async getMonthlyPayroll(
    companyId: string,
    month: number,
    year: number
  ): Promise<PayrollRecord[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("companyId", "==", companyId)
      .where("month", "==", month)
      .where("year", "==", year)
      .get();

    return snapshot.docs.map((d) => d.data() as PayrollRecord);
  }
}
