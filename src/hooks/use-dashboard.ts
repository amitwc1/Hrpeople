import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/query/api-client";
import type { DashboardStats, EmployeeDashboardData, ManagerDashboardData } from "@/types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/api/dashboard"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useEmployeeDashboard() {
  return useQuery({
    queryKey: ["dashboard", "employee"],
    queryFn: () => api.get<EmployeeDashboardData>("/api/dashboard"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useManagerDashboard() {
  return useQuery({
    queryKey: ["dashboard", "manager"],
    queryFn: () => api.get<ManagerDashboardData>("/api/dashboard"),
    staleTime: 2 * 60 * 1000,
  });
}
