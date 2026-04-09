"use client";

import { useState } from "react";
import { useSessions, useActiveSessions } from "@/hooks/use-sessions";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  Filter,
} from "lucide-react";
import { motion } from "framer-motion";
import type { EmployeeSession, SessionStatus } from "@/types";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "Ongoing";
  if (minutes < 1) return "< 1 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function DeviceIcon({ type }: { type: string }) {
  switch (type) {
    case "mobile":
      return <Smartphone className="h-4 w-4" />;
    case "tablet":
      return <Tablet className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const variants: Record<SessionStatus, { class: string; label: string }> = {
    ACTIVE: { class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Active" },
    ENDED: { class: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", label: "Ended" },
    EXPIRED: { class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Expired" },
  };
  const v = variants[status] || variants.ENDED;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${v.class}`}>
      {status === "ACTIVE" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {v.label}
    </span>
  );
}

export default function SessionsPage() {
  useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const pageSize = 20;

  const { data: sessions, isLoading } = useSessions({
    page,
    pageSize,
    status: statusFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const { data: activeData } = useActiveSessions();

  // Client-side search filter on the fetched results
  const filteredSessions = (sessions || []).filter((s: EmployeeSession) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.employeeName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      (s.ipAddress && s.ipAddress.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Employee Sessions</h1>
        <p className="text-muted-foreground">
          Track and monitor all employee login sessions permanently
        </p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        className="grid gap-4 md:grid-cols-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-emerald-100 p-3 dark:bg-emerald-900/30">
              <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Now</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {activeData?.activeCount ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-blue-100 p-3 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sessions Loaded</p>
              <p className="text-2xl font-bold">{sessions?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-violet-100 p-3 dark:bg-violet-900/30">
              <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Duration</p>
              <p className="text-2xl font-bold">
                {sessions && sessions.length > 0
                  ? formatDuration(
                      Math.round(
                        sessions
                          .filter((s: EmployeeSession) => s.durationMinutes !== null)
                          .reduce((sum: number, s: EmployeeSession) => sum + (s.durationMinutes || 0), 0) /
                          Math.max(
                            sessions.filter((s: EmployeeSession) => s.durationMinutes !== null).length,
                            1
                          )
                      )
                    )
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, IP..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ENDED">Ended</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
              <Input
                type="date"
                className="w-[160px]"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                placeholder="From"
              />
              <Input
                type="date"
                className="w-[160px]"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                placeholder="To"
              />
              {(statusFilter || startDate || endDate || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("");
                    setStartDate("");
                    setEndDate("");
                    setSearch("");
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sessions Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Login Time</TableHead>
                      <TableHead>Logout Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Browser / OS</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((session: EmployeeSession) => (
                      <TableRow key={session.id} className="group">
                        <TableCell>
                          <div>
                            <p className="font-medium">{session.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{session.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {session.department}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={session.status} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDateTime(session.loginAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDateTime(session.logoutAt)}
                        </TableCell>
                        <TableCell>
                          <span className={session.status === "ACTIVE" ? "text-emerald-600 font-medium" : ""}>
                            {formatDuration(session.durationMinutes)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5" title={session.deviceType}>
                            <DeviceIcon type={session.deviceType} />
                            <span className="text-xs capitalize">{session.deviceType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{session.browser || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{session.os || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            {session.ipAddress || "—"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSessions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          {search ? "No sessions match your search" : "No sessions recorded yet"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!sessions || sessions.length < pageSize}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
