import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/query/api-client";
import type { Employee } from "@/types";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/lib/validations/schemas";

export const employeeKeys = {
  all: ["employees"] as const,
  lists: () => [...employeeKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...employeeKeys.lists(), filters] as const,
  details: () => [...employeeKeys.all, "detail"] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
};

export function useEmployees(filters: {
  page?: number;
  pageSize?: number;
  department?: string;
  status?: string;
} = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.department) params.set("department", filters.department);
  if (filters.status) params.set("status", filters.status);

  return useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: () => api.get<Employee[]>(`/api/employees?${params.toString()}`),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => api.get<Employee>(`/api/employees/${id}`),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmployeeInput) => api.post<Employee>("/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateEmployeeInput) => api.patch<Employee>(`/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useResetEmployeePassword(id: string) {
  return useMutation({
    mutationFn: (newPassword: string) =>
      api.patch<{ message: string }>(`/api/employees/${id}/reset-password`, { newPassword }),
  });
}
