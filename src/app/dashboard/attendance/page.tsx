"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  useTodayAttendance,
  useAttendanceHistory,
  useClockIn,
  useClockOut,
  useCompanyAttendanceStats,
  useCompanyAttendanceRecords,
} from "@/hooks/use-attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  LogIn,
  LogOut,
  Timer,
  Coffee,
  Users,
  CalendarDays,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { AttendanceRecord, AttendanceStatus, Role } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format decimal hours into "Xh Ym" string */
function formatHM(decimalHours: number): string {
  if (decimalHours <= 0) return "0m";
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format ms diff between two ISO timestamps into "Xh Ym" */
function formatDiffHM(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return "0m";
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function statusBadge(status: AttendanceStatus) {
  const map: Record<AttendanceStatus, { variant: "success" | "destructive" | "warning" | "secondary" | "default"; label: string }> = {
    PRESENT: { variant: "success", label: "Present" },
    LATE: { variant: "warning", label: "Late" },
    HALF_DAY: { variant: "warning", label: "Half Day" },
    ABSENT: { variant: "destructive", label: "Absent" },
    ON_LEAVE: { variant: "secondary", label: "On Leave" },
    HOLIDAY: { variant: "default", label: "Holiday" },
  };
  const { variant, label } = map[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

function getLast30DaysRange() {
  const end = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const start = new Date(Date.now() - 30 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return { start, end };
}

function isManagerOrAbove(role: Role) {
  return role === "MANAGER" || role === "COMPANY_ADMIN" || role === "SUPER_ADMIN";
}

// ─── Live Timer ───────────────────────────────────────────────

function LiveTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    function tick() {
      const diff = Date.now() - new Date(since).getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setElapsed(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [since]);
  return <span className="font-mono text-3xl font-bold tabular-nums">{elapsed}</span>;
}

// ─── Main Page ────────────────────────────────────────────────

export default function AttendancePage() {
  const { profile } = useAuth();
  const today = useTodayAttendance();
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  const { start, end } = useMemo(() => getLast30DaysRange(), []);
  const history = useAttendanceHistory(start, end);

  const [error, setError] = useState<string | null>(null);

  const record = today.data;
  const hasOpenSession = record?.sessions?.some((s) => s.checkIn && !s.checkOut) ?? false;
  const allSessionsClosed =
    record && record.sessions.length > 0 && record.sessions.every((s) => !!s.checkOut);
  const isOnFullLeave = record?.isOnLeave && !record?.isHalfDayLeave;
  const isHoliday = record?.status === "HOLIDAY";

  function handleClockIn() {
    setError(null);
    clockIn.mutate(undefined, {
      onError: (err) => setError(err instanceof Error ? err.message : "Clock in failed"),
    });
  }

  function handleClockOut() {
    setError(null);
    clockOut.mutate(undefined, {
      onError: (err) => setError(err instanceof Error ? err.message : "Clock out failed"),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          Track your daily attendance &amp; sessions
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {isOnFullLeave && (
        <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-blue-800 text-sm">
          <CalendarDays className="h-4 w-4 shrink-0" />
          You are on {record?.leaveTypeName || "leave"} today. Clock-in is disabled.
        </div>
      )}

      {isHoliday && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-green-800 text-sm">
          <CalendarDays className="h-4 w-4 shrink-0" />
          Today is a company holiday.
        </div>
      )}

      {/* ── Live Session Card ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Timer className="h-5 w-5" /> Current Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          {today.isLoading ? (
            <div className="h-10 w-48 animate-pulse rounded bg-muted" />
          ) : hasOpenSession ? (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <LiveTimer since={record!.sessions.find((s) => !s.checkOut)!.checkIn} />
                <p className="mt-1 text-sm text-muted-foreground">
                  Session {record!.sessions.length} &middot; Started at{" "}
                  {formatTime(record!.sessions.find((s) => !s.checkOut)!.checkIn)}
                </p>
              </div>
              <Button
                size="lg"
                variant="destructive"
                onClick={handleClockOut}
                disabled={clockOut.isPending || isOnFullLeave}
                className="gap-2"
              >
                <LogOut className="h-5 w-5" />
                {clockOut.isPending ? "Clocking out..." : "Clock Out"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                {allSessionsClosed
                  ? `Done for the day — ${formatHM(record!.totalWorkingHours)} logged`
                  : "Not clocked in yet"}
              </p>
              {!allSessionsClosed && !isOnFullLeave && !isHoliday && (
                <Button
                  size="lg"
                  onClick={handleClockIn}
                  disabled={clockIn.isPending}
                  className="gap-2"
                >
                  <LogIn className="h-5 w-5" />
                  {clockIn.isPending ? "Clocking in..." : record ? "Resume (New Session)" : "Clock In"}
                </Button>
              )}
              {allSessionsClosed && !isOnFullLeave && !isHoliday && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleClockIn}
                  disabled={clockIn.isPending}
                  className="gap-2"
                >
                  <Coffee className="h-4 w-4" />
                  {clockIn.isPending ? "Starting..." : "Start New Session"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Today Summary ─────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {today.isLoading ? (
              <div className="h-6 w-20 animate-pulse rounded bg-muted" />
            ) : record ? (
              statusBadge(record.status)
            ) : (
              <Badge variant="secondary">Not Marked</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">First In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-semibold">{formatTime(record?.checkIn ?? null)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-semibold">{formatTime(record?.checkOut ?? null)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-lg font-semibold">
              {record ? formatHM(record.totalWorkingHours) : "—"}
            </span>
            {record && record.overtimeHours > 0 && (
              <span className="ml-2 text-xs text-green-600">+{formatHM(record.overtimeHours)} OT</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Sessions Breakdown ────────────────────────────── */}
      {record && record.sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5" /> Sessions Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.sessions.map((s, i) => {
                  return (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{formatTime(s.checkIn)}</TableCell>
                      <TableCell>{formatTime(s.checkOut)}</TableCell>
                      <TableCell>
                        {s.checkIn && s.checkOut
                          ? formatDiffHM(s.checkIn, s.checkOut)
                          : "In progress..."}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── History (last 30 days) ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Attendance History (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !history.data?.length ? (
            <p className="text-sm text-muted-foreground">No records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>OT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusBadge(r.status)}
                        {r.isOnLeave && r.leaveTypeName && (
                          <span className="text-xs text-muted-foreground">({r.leaveTypeName})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatTime(r.checkIn)}</TableCell>
                    <TableCell>{formatTime(r.checkOut)}</TableCell>
                    <TableCell>{r.sessions.length}</TableCell>
                    <TableCell>{formatHM(r.totalWorkingHours)}</TableCell>
                    <TableCell>
                      {r.overtimeHours > 0 ? (
                        <span className="text-green-600">+{formatHM(r.overtimeHours)}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Admin Company View ────────────────────────────── */}
      {profile && isManagerOrAbove(profile.role) && (
        <AdminAttendanceSection />
      )}
    </div>
  );
}

// ─── Admin Section ────────────────────────────────────────────

function SessionDuration({ checkIn, checkOut }: { checkIn: string; checkOut: string | null }) {
  if (checkIn && checkOut) {
    return <span>{formatDiffHM(checkIn, checkOut)}</span>;
  }
  return <span className="text-emerald-600 font-medium animate-pulse">Active</span>;
}

function ExpandableRow({ record }: { record: AttendanceRecord }) {
  const [expanded, setExpanded] = useState(false);
  const hasSessions = record.sessions.length > 0;

  return (
    <>
      <TableRow
        className={hasSessions ? "cursor-pointer hover:bg-muted/50" : ""}
        onClick={() => hasSessions && setExpanded(!expanded)}
      >
        <TableCell className="w-8">
          {hasSessions && (
            expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">{record.employeeName}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {statusBadge(record.status)}
            {record.isOnLeave && record.leaveTypeName && (
              <span className="text-xs text-muted-foreground">({record.leaveTypeName})</span>
            )}
          </div>
        </TableCell>
        <TableCell>{formatTime(record.checkIn)}</TableCell>
        <TableCell>{formatTime(record.checkOut)}</TableCell>
        <TableCell>
          <Badge variant={record.sessions.length > 1 ? "default" : "secondary"} className="font-mono">
            {record.sessions.length}
          </Badge>
        </TableCell>
        <TableCell>{formatHM(record.totalWorkingHours)}</TableCell>
        <TableCell>
          {record.isLate ? (
            <Badge variant="warning">Late</Badge>
          ) : (
            "—"
          )}
        </TableCell>
      </TableRow>
      {expanded && record.sessions.length > 0 && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-0">
            <div className="px-6 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Session Breakdown — {record.sessions.length} session{record.sessions.length > 1 ? "s" : ""}
              </p>
              <div className="rounded-lg border bg-background overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {record.sessions.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <LogIn className="h-3.5 w-3.5 text-emerald-500" />
                            {formatTime(s.checkIn)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <LogOut className="h-3.5 w-3.5 text-red-400" />
                            {formatTime(s.checkOut)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <SessionDuration checkIn={s.checkIn} checkOut={s.checkOut} />
                        </TableCell>
                        <TableCell>
                          {!s.checkOut ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              In Progress
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Completed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {record.overtimeHours > 0 && (
                <p className="mt-2 text-xs text-green-600">
                  +{formatHM(record.overtimeHours)} overtime
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function AdminAttendanceSection() {
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  );
  const stats = useCompanyAttendanceStats(date);
  const records = useCompanyAttendanceRecords(date);

  return (
    <div className="space-y-4 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Company Attendance
        </h2>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
      </div>

      {/* Stats cards */}
      {stats.data && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-7">
          {([
            ["Total", stats.data.total, "default"],
            ["Present", stats.data.present, "success"],
            ["Late", stats.data.late, "warning"],
            ["Half Day", stats.data.halfDay, "warning"],
            ["Absent", stats.data.absent, "destructive"],
            ["On Leave", stats.data.onLeave, "secondary"],
            ["Holiday", stats.data.holiday, "default"],
          ] as const).map(([label, value, variant]) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold">{value}</p>
                <Badge variant={variant} className="mt-1">
                  {label}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Click on any employee row to expand and view their individual check-in / check-out sessions.
      </p>

      {/* Employee records table with expandable sessions */}
      {records.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : !records.data?.length ? (
        <p className="text-sm text-muted-foreground">No attendance records for this date.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>First In</TableHead>
                  <TableHead>Last Out</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Late</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.data.map((r) => (
                  <ExpandableRow key={r.id} record={r} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
