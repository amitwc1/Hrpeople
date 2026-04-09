import { z } from "zod";

// ─── Employee Schemas ─────────────────────────────────────────
export const addressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "Zip code is required"),
  country: z.string().min(1, "Country is required"),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(10, "Valid phone number is required"),
});

export const bankDetailsSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  ifscCode: z.string().min(1, "IFSC code is required"),
  accountHolderName: z.string().min(1, "Account holder name is required"),
});

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(10, "Valid phone number is required"),
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  role: z.enum(["COMPANY_ADMIN", "MANAGER", "EMPLOYEE"]),
  managerId: z.string().optional(),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  address: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  bankDetails: bankDetailsSchema.optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ─── Leave Schemas ────────────────────────────────────────────
export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().min(1, "Reason is required").max(500),
  isHalfDay: z.boolean().optional(),
  halfDayDate: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
  compOffDate: z.string().optional(),
});

export const reviewLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(500).optional(),
  forceOverride: z.boolean().optional(),
});

export type CreateLeaveInput = z.infer<typeof createLeaveRequestSchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;

// ─── Attendance Schemas ───────────────────────────────────────
export const checkInSchema = z.object({
  notes: z.string().max(200).optional(),
});

export const checkOutSchema = z.object({
  notes: z.string().max(200).optional(),
});

// ─── Payroll Schemas ──────────────────────────────────────────
export const payrollAllowanceSchema = z.object({
  name: z.string().min(1),
  amount: z.number().min(0),
});

export const payrollDeductionSchema = z.object({
  name: z.string().min(1),
  amount: z.number().min(0),
});

export const createPayrollSchema = z.object({
  employeeId: z.string().min(1),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  basicSalary: z.number().min(0),
  allowances: z.array(payrollAllowanceSchema).default([]),
  deductions: z.array(payrollDeductionSchema).default([]),
});

export type CreatePayrollInput = z.infer<typeof createPayrollSchema>;

// ─── Company Schemas ──────────────────────────────────────────
export const createCompanySchema = z.object({
  name: z.string().min(2, "Company name is required").max(100),
  domain: z.string().min(1, "Domain is required"),
});

export const companySettingsSchema = z.object({
  timezone: z.string(),
  dateFormat: z.string(),
  workingDays: z.array(z.number().min(0).max(6)),
  workingHours: z.object({
    start: z.string(),
    end: z.string(),
  }),
  leavePolicy: z.object({
    annualLeave: z.number().min(0),
    sickLeave: z.number().min(0),
    casualLeave: z.number().min(0),
  }),
  payrollDay: z.number().min(1).max(28),
});

// ─── Auth Schemas ─────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Name is required"),
  companyName: z.string().min(2, "Company name is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
