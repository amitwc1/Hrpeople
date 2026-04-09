import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/query/api-client";
import type { EmployeeSession } from "@/types";

export const sessionKeys = {
  all: ["sessions"] as const,
  lists: () => [...sessionKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...sessionKeys.lists(), filters] as const,
  active: () => [...sessionKeys.all, "active"] as const,
};

export function useSessions(filters: {
  page?: number;
  pageSize?: number;
  employeeId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  if (filters.status) params.set("status", filters.status);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  return useQuery({
    queryKey: sessionKeys.list(filters),
    queryFn: () =>
      api.get<EmployeeSession[]>(`/api/sessions?${params.toString()}`),
  });
}

export function useActiveSessions() {
  return useQuery({
    queryKey: sessionKeys.active(),
    queryFn: () =>
      api.get<{ activeCount: number }>("/api/sessions/active"),
    refetchInterval: 30000, // Poll every 30 seconds
  });
}
