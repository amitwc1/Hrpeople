"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/query/api-client";
import type { AttendanceRecord, CompanyAttendanceStats, Shift } from "@/types";

// ─── Employee Hooks ───────────────────────────────────────────

export function useTodayAttendance() {
  return useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () => api.get<AttendanceRecord | null>("/api/attendance"),
    refetchInterval: 60_000, // poll every minute for live timer
  });
}

export function useAttendanceHistory(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["attendance", "history", startDate, endDate],
    queryFn: () =>
      api.get<AttendanceRecord[]>(
        `/api/attendance?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled: !!startDate && !!endDate,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: { notes?: string; location?: { lat: number; lng: number } }) =>
      api.post<AttendanceRecord>("/api/attendance", data || {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: { notes?: string; location?: { lat: number; lng: number } }) =>
      api.patch<AttendanceRecord>("/api/attendance", data || {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

// ─── Admin / Manager Hooks ────────────────────────────────────

export function useCompanyAttendanceStats(date?: string) {
  return useQuery({
    queryKey: ["attendance", "company", "stats", date],
    queryFn: () => {
      const params = new URLSearchParams({ view: "stats" });
      if (date) params.set("date", date);
      return api.get<CompanyAttendanceStats>(
        `/api/attendance/company?${params.toString()}`
      );
    },
  });
}

export function useCompanyAttendanceRecords(date?: string) {
  return useQuery({
    queryKey: ["attendance", "company", "records", date],
    queryFn: () => {
      const params = new URLSearchParams({ view: "records" });
      if (date) params.set("date", date);
      return api.get<AttendanceRecord[]>(
        `/api/attendance/company?${params.toString()}`
      );
    },
  });
}

export function useAdminUpdateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      attendanceId: string;
      checkIn?: string;
      checkOut?: string;
      status?: string;
      notes?: string;
    }) => api.patch<AttendanceRecord>("/api/attendance/company", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

// ─── Shift Hooks ──────────────────────────────────────────────

export function useShifts() {
  return useQuery({
    queryKey: ["shifts"],
    queryFn: () => api.get<Shift[]>("/api/attendance/shifts"),
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      startTime: string;
      endTime: string;
      graceMinutes?: number;
      workingHours?: number;
      isDefault?: boolean;
    }) => api.post<Shift>("/api/attendance/shifts", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { shiftId: string; [key: string]: unknown }) =>
      api.patch<Shift>("/api/attendance/shifts", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shiftId: string) =>
      api.delete<void>(`/api/attendance/shifts?shiftId=${shiftId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}
