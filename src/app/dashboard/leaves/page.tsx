"use client";

import { useState, useCallback } from "react";
import {
  useLeaves,
  useLeaveBalances,
  useLeaveTypes,
  useCreateLeave,
  useCancelLeave,
  useReviewLeave,
} from "@/hooks/use-leaves";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Check,
  X,
  Calendar,
  Clock,
  TrendingDown,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Timer,
  Send,
} from "lucide-react";
import type { LeaveStatus, CompanyLeaveType } from "@/types";

/* ───────────────── STATUS CONFIG ───────────────── */
const STATUS_CONFIG: Record<LeaveStatus, { label: string; variant: "success" | "destructive" | "warning" | "secondary" | "outline"; icon: typeof Check }> = {
  PENDING: { label: "Pending", variant: "warning", icon: Timer },
  PENDING_L2: { label: "Pending L2", variant: "warning", icon: Timer },
  PENDING_L3: { label: "Pending L3", variant: "warning", icon: Timer },
  APPROVED: { label: "Approved", variant: "success", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", variant: "destructive", icon: XCircle },
  CANCELLED: { label: "Cancelled", variant: "secondary", icon: X },
};

const STATUS_FILTERS: { value: LeaveStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  return `${formatDate(start)} → ${formatDate(end)}`;
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════ */
export default function LeavesPage() {
  const { hasRole } = useAuth();
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "">("");
  const [showForm, setShowForm] = useState(false);

  const { data: leavesData, isLoading } = useLeaves({
    status: statusFilter || undefined,
  });
  const leaves = leavesData?.leaves;
  const currentEmployeeId = leavesData?.currentEmployeeId;
  const { data: balances } = useLeaveBalances();
  const { data: leaveTypes } = useLeaveTypes();
  const cancelLeave = useCancelLeave();

  const isManager = hasRole("MANAGER");

  /* Balance Stats */
  const totalAllocated = balances?.reduce((s, b) => s + b.totalAllocated, 0) ?? 0;
  const totalUsed = balances?.reduce((s, b) => s + b.used, 0) ?? 0;
  const totalRemaining = balances?.reduce((s, b) => s + b.remaining, 0) ?? 0;
  const pendingCount = leaves?.filter(
    (l) => l.status === "PENDING" || l.status === "PENDING_L2" || l.status === "PENDING_L3"
  ).length ?? 0;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            Leave Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Apply for leave, track balances, and manage requests
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Apply for Leave
        </Button>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total Allocated" value={totalAllocated} subtitle="days this year" icon={Calendar} color="blue" />
        <SummaryCard title="Used" value={totalUsed} subtitle="days consumed" icon={TrendingDown} color="red" />
        <SummaryCard title="Remaining" value={totalRemaining} subtitle="days available" icon={CheckCircle2} color="green" />
        <SummaryCard title="Pending" value={pendingCount} subtitle="awaiting approval" icon={Clock} color="amber" />
      </div>

      {/* ── Leave Balance Breakdown ── */}
      {balances && balances.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Leave Balances</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {balances.map((bal) => {
              const pct = bal.totalAllocated > 0 ? (bal.remaining / bal.totalAllocated) * 100 : 0;
              const leaveType = leaveTypes?.find((t) => t.id === bal.leaveTypeId);
              const typeColor = leaveType?.color || "#3b82f6";
              return (
                <Card key={bal.id} className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-1 w-full" style={{ backgroundColor: typeColor }} />
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: typeColor }} />
                        <span className="font-semibold text-sm">{bal.leaveTypeName}</span>
                      </div>
                      {leaveType && <Badge variant="outline" className="text-xs">{leaveType.code}</Badge>}
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <span className="text-3xl font-bold">{bal.remaining}</span>
                        <span className="text-muted-foreground text-sm ml-1">/ {bal.totalAllocated}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{bal.used} used</span>
                    </div>
                    <Progress value={Math.min(pct, 100)} className="h-2" />
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      {bal.carryForward > 0 && <span>+{bal.carryForward} carried</span>}
                      {(bal.encashed ?? 0) > 0 && <span>{bal.encashed} encashed</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Apply Form ── */}
      {showForm && <LeaveForm leaveTypes={leaveTypes || []} onClose={() => setShowForm(false)} />}

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-2 border-b pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Requests Table ── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !leaves || leaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-lg font-medium">No leave requests found</p>
              <p className="text-sm">{statusFilter ? "Try a different filter" : "Apply for your first leave above"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  {isManager && <TableHead>Employee</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((leave) => {
                  const config = STATUS_CONFIG[leave.status];
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={leave.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{leave.leaveTypeName}</span>
                          {leave.isHalfDay && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Half</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDateRange(leave.startDate, leave.endDate)}</TableCell>
                      <TableCell className="text-center font-semibold">{leave.totalDays}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{leave.reason}</TableCell>
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      {isManager && <TableCell className="font-medium text-sm">{leave.employeeName}</TableCell>}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isManager && (leave.status === "PENDING" || leave.status === "PENDING_L2" || leave.status === "PENDING_L3") && (
                            <>
                              <ReviewButton leaveId={leave.id} action="APPROVED" />
                              <ReviewButton leaveId={leave.id} action="REJECTED" />
                            </>
                          )}
                          {leave.employeeId === currentEmployeeId &&
                            (leave.status === "PENDING" || leave.status === "PENDING_L2" || leave.status === "PENDING_L3" || leave.status === "APPROVED") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => cancelLeave.mutate(leave.id)}
                                disabled={cancelLeave.isPending}
                              >
                                Cancel
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LEAVE FORM COMPONENT
   ═══════════════════════════════════════════════════ */
function LeaveForm({ leaveTypes, onClose }: { leaveTypes: CompanyLeaveType[]; onClose: () => void }) {
  const createLeave = useCreateLeave();
  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    isHalfDay: false,
    halfDayDate: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const selectedType = leaveTypes.find((t) => t.id === form.leaveTypeId);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitted) return;
      setSubmitted(true);
      try {
        await createLeave.mutateAsync({
          leaveTypeId: form.leaveTypeId,
          startDate: form.startDate,
          endDate: form.isHalfDay ? form.startDate : form.endDate,
          reason: form.reason,
          isHalfDay: form.isHalfDay || undefined,
          halfDayDate: form.isHalfDay ? form.startDate : undefined,
        });
        onClose();
      } catch {
        setSubmitted(false);
      }
    },
    [form, submitted, createLeave, onClose]
  );

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-violet-600">
            <Send className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>New Leave Request</CardTitle>
            <CardDescription>Fill in the details below to submit your leave application</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-5">
          {createLeave.isError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive">
                {createLeave.error instanceof Error ? createLeave.error.message : "Failed to submit leave request"}
              </div>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Leave Type *</Label>
              {leaveTypes.filter((lt) => lt.isActive).length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 p-3">
                  No leave types configured. Ask your admin to seed leave types from{" "}
                  <a href="/dashboard/leaves/admin" className="underline font-medium text-primary">Leave Admin</a>.
                </p>
              ) : (
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  value={form.leaveTypeId}
                  onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
                  required
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.filter((lt) => lt.isActive).map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.code}) {lt.isPaid ? "" : "— Unpaid"}
                    </option>
                  ))}
                </select>
              )}
              {selectedType && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedType.color }} />
                  {selectedType.isPaid ? "Paid Leave" : "Unpaid Leave"}
                </div>
              )}
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-3 text-sm cursor-pointer select-none rounded-lg border border-input px-4 py-2.5 transition-colors hover:bg-muted">
                <input
                  type="checkbox"
                  checked={form.isHalfDay}
                  onChange={(e) => setForm((f) => ({ ...f, isHalfDay: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-medium">Half Day</span>
                  <p className="text-xs text-muted-foreground">Apply for half day only</p>
                </div>
              </label>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Date *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.isHalfDay ? e.target.value : f.endDate }))}
                className="h-10"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">End Date *</Label>
              <Input
                type="date"
                value={form.isHalfDay ? form.startDate : form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                min={form.startDate}
                disabled={form.isHalfDay}
                className="h-10"
                required
              />
              {form.isHalfDay && <p className="text-xs text-muted-foreground">Half-day leaves are single-day</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Reason *</Label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background text-foreground px-3 py-2.5 text-sm min-h-[100px] placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 resize-none"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Briefly explain the reason for your leave..."
              maxLength={500}
              required
            />
            <p className="text-xs text-muted-foreground text-right">{form.reason.length}/500</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={createLeave.isPending || submitted}
              className="bg-gradient-to-r from-blue-600 to-violet-600 text-white min-w-[160px]"
            >
              {createLeave.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Submit Request</>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   SUMMARY CARD
   ═══════════════════════════════════════════════════ */
function SummaryCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: number; subtitle: string; icon: typeof Calendar; color: "blue" | "red" | "green" | "amber";
}) {
  const colors = {
    blue: "from-blue-500/10 to-blue-600/5 text-blue-600 border-blue-200",
    red: "from-red-500/10 to-red-600/5 text-red-600 border-red-200",
    green: "from-green-500/10 to-green-600/5 text-green-600 border-green-200",
    amber: "from-amber-500/10 to-amber-600/5 text-amber-600 border-amber-200",
  };
  const iconColors = {
    blue: "bg-blue-100 text-blue-600",
    red: "bg-red-100 text-red-600",
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <Card className={`bg-gradient-to-br ${colors[color]} border`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   REVIEW BUTTON
   ═══════════════════════════════════════════════════ */
function ReviewButton({ leaveId, action }: { leaveId: string; action: "APPROVED" | "REJECTED" }) {
  const review = useReviewLeave(leaveId);
  const [conflict, setConflict] = useState<string | null>(null);

  function handleClick(force?: boolean) {
    setConflict(null);
    review.mutate(
      { status: action, forceOverride: force || undefined },
      {
        onError: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.toLowerCase().includes("attendance conflict") && action === "APPROVED") {
            setConflict(msg);
          }
        },
      }
    );
  }

  if (conflict) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-amber-600 max-w-[180px] truncate" title={conflict}>Conflict</span>
        <Button variant="ghost" size="sm" onClick={() => handleClick(true)} disabled={review.isPending} title="Force Approve" className="text-amber-600">
          <ArrowRight className="h-4 w-4 mr-1" />Override
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => handleClick()}
      disabled={review.isPending}
      title={action === "APPROVED" ? "Approve" : "Reject"}
      className={action === "APPROVED" ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-red-600 hover:text-red-700 hover:bg-red-50"}
    >
      {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : action === "APPROVED" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
    </Button>
  );
}
