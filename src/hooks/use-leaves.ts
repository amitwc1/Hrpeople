import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/query/api-client";
import type {
  LeaveRequest,
  LeaveBalance,
  LeaveStatus,
  CompanyLeaveType,
  LeavePolicy,
  Holiday,
  LeaveAuditLog,
} from "@/types";
import type { CreateLeaveInput, ReviewLeaveInput } from "@/lib/validations/schemas";

export const leaveKeys = {
  all: ["leaves"] as const,
  lists: () => [...leaveKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...leaveKeys.lists(), filters] as const,
  balance: (year: number) => [...leaveKeys.all, "balance", year] as const,
  types: () => [...leaveKeys.all, "types"] as const,
  policies: () => [...leaveKeys.all, "policies"] as const,
  holidays: (year?: number) => [...leaveKeys.all, "holidays", year] as const,
  audit: (leaveId: string) => [...leaveKeys.all, "audit", leaveId] as const,
  teamCalendar: (year: number, month: number) => [...leaveKeys.all, "team-calendar", year, month] as const,
};

// ─── Leave Requests ───────────────────────────────────────────

export function useLeaves(filters: { status?: LeaveStatus; page?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));

  return useQuery({
    queryKey: leaveKeys.list(filters),
    queryFn: async () => {
      const { auth: firebaseAuth } = await import("@/lib/firebase/config");
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      const response = await fetch(`/api/leaves?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Request failed");
      return {
        leaves: json.data as LeaveRequest[],
        currentEmployeeId: json.currentEmployeeId as string,
      };
    },
  });
}

export function useLeaveBalances(year?: number) {
  const y = year || new Date().getFullYear();
  return useQuery({
    queryKey: leaveKeys.balance(y),
    queryFn: () => api.get<LeaveBalance[]>(`/api/leaves/balance?year=${y}`),
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeaveInput) => api.post<LeaveRequest>("/api/leaves", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.all });
    },
  });
}

export function useReviewLeave(leaveId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReviewLeaveInput) =>
      api.patch<LeaveRequest>(`/api/leaves/${leaveId}/review`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.all });
    },
  });
}

export function useCancelLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaveId: string) => api.delete(`/api/leaves/${leaveId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.all });
    },
  });
}

// ─── Leave Types ──────────────────────────────────────────────

export function useLeaveTypes() {
  return useQuery({
    queryKey: leaveKeys.types(),
    queryFn: () => api.get<CompanyLeaveType[]>("/api/leaves/types"),
  });
}

export function useCreateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; code: string; isPaid?: boolean; color?: string }) =>
      api.post<CompanyLeaveType>("/api/leaves/types", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.types() }),
  });
}

export function useUpdateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { typeId: string; [key: string]: unknown }) =>
      api.patch<CompanyLeaveType>("/api/leaves/types", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.types() }),
  });
}

export function useDeleteLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (typeId: string) =>
      api.delete(`/api/leaves/types?typeId=${typeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.types() }),
  });
}

// ─── Leave Policies ───────────────────────────────────────────

export function useLeavePolicies() {
  return useQuery({
    queryKey: leaveKeys.policies(),
    queryFn: () => api.get<LeavePolicy[]>("/api/leaves/policies"),
  });
}

export function useCreateLeavePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<LeavePolicy>("/api/leaves/policies", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.policies() }),
  });
}

export function useUpdateLeavePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { policyId: string; [key: string]: unknown }) =>
      api.patch<LeavePolicy>("/api/leaves/policies", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.policies() }),
  });
}

export function useDeleteLeavePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (policyId: string) =>
      api.delete(`/api/leaves/policies?policyId=${policyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.policies() }),
  });
}

// ─── Holidays ─────────────────────────────────────────────────

export function useHolidays(year?: number) {
  return useQuery({
    queryKey: leaveKeys.holidays(year),
    queryFn: () => {
      const params = year ? `?year=${year}` : "";
      return api.get<Holiday[]>(`/api/leaves/holidays${params}`);
    },
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; date: string; isOptional?: boolean }) =>
      api.post<Holiday>("/api/leaves/holidays", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { holidayId: string; [key: string]: unknown }) =>
      api.patch<Holiday>("/api/leaves/holidays", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (holidayId: string) =>
      api.delete(`/api/leaves/holidays?holidayId=${holidayId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}

// ─── Audit Logs ───────────────────────────────────────────────

export function useLeaveAuditLogs(leaveId: string) {
  return useQuery({
    queryKey: leaveKeys.audit(leaveId),
    queryFn: () => api.get<LeaveAuditLog[]>(`/api/leaves/${leaveId}/audit`),
    enabled: !!leaveId,
  });
}

// ─── Team Calendar ────────────────────────────────────────────

export function useTeamCalendar(year: number, month: number, department?: string) {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (department) params.set("department", department);
  return useQuery({
    queryKey: leaveKeys.teamCalendar(year, month),
    queryFn: () => api.get<{ date: string; employeeId: string; employeeName: string; leaveTypeName: string; isHalfDay: boolean; status: LeaveStatus }[]>(
      `/api/leaves/team-calendar?${params.toString()}`
    ),
  });
}

// ─── Encashment ───────────────────────────────────────────────

export function useEncashLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { employeeId: string; leaveTypeId: string; year: number; days: number }) =>
      api.post<LeaveBalance>("/api/leaves/encash", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}

// ─── Seed & Initialize ───────────────────────────────────────

export function useSeedLeaveTypes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ types: CompanyLeaveType[]; policies: LeavePolicy[] }>("/api/leaves/seed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}

export function useInitBalances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: { year?: number }) =>
      api.post<{ initialized: number; year: number }>("/api/leaves/balance/init", data || {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}
