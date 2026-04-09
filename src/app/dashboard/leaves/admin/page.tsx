"use client";

import { useState } from "react";
import {
  useLeaveTypes,
  useCreateLeaveType,
  useDeleteLeaveType,
  useLeavePolicies,
  useCreateLeavePolicy,
  useDeleteLeavePolicy,
  useHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  useLeaves,
  useReviewLeave,
  useSeedLeaveTypes,
  useInitBalances,
} from "@/hooks/use-leaves";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Plus,
  Trash2,
  CalendarDays,
  Settings,
  BookOpen,
  CheckCircle,
  Loader2,
  Shield,
  Zap,
  Users,
  Check,
  X,
  ArrowRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { LeaveStatus } from "@/types";

type Tab = "approvals" | "types" | "policies" | "holidays";

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function LeaveAdminPage() {
  const [tab, setTab] = useState<Tab>("approvals");

  const tabs = [
    { value: "approvals" as Tab, label: "Approvals", icon: Shield },
    { value: "types" as Tab, label: "Leave Types", icon: BookOpen },
    { value: "policies" as Tab, label: "Policies", icon: Settings },
    { value: "holidays" as Tab, label: "Holidays", icon: CalendarDays },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
            Leave Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage leave types, policies, holidays, and approve requests
          </p>
        </div>
        <QuickActions />
      </div>

      <div className="flex gap-2 border-b pb-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "approvals" && <ApprovalsSection />}
      {tab === "types" && <LeaveTypesSection />}
      {tab === "policies" && <PoliciesSection />}
      {tab === "holidays" && <HolidaysSection />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   QUICK ACTIONS (Seed + Init Balance)
   ═══════════════════════════════════════════════════ */
function QuickActions() {
  const seed = useSeedLeaveTypes();
  const initBal = useInitBalances();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg && (
        <span className={`text-xs px-3 py-1 rounded-full ${msg.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {msg.text}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setMsg(null);
          seed.mutate(undefined, {
            onSuccess: () => setMsg({ type: "success", text: "Indian leave types seeded!" }),
            onError: (e) => setMsg({ type: "error", text: e instanceof Error ? e.message : "Failed" }),
          });
        }}
        disabled={seed.isPending}
      >
        {seed.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
        Seed Indian Types
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setMsg(null);
          initBal.mutate(undefined, {
            onSuccess: () => setMsg({ type: "success", text: "Balances initialized!" }),
            onError: (e) => setMsg({ type: "error", text: e instanceof Error ? e.message : "Failed" }),
          });
        }}
        disabled={initBal.isPending}
      >
        {initBal.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Users className="mr-2 h-3 w-3" />}
        Init Balances
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   APPROVALS SECTION
   ═══════════════════════════════════════════════════ */
function ApprovalsSection() {
  const { data: leavesData, isLoading } = useLeaves({ status: "PENDING" as LeaveStatus });
  const leaves = leavesData?.leaves || [];

  const pendingCount = leaves.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Pending Approvals</h2>
          {pendingCount > 0 && (
            <Badge variant="warning" className="text-xs px-2.5">
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : leaves.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mb-3 text-green-500 opacity-50" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm">No pending leave requests to review</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leaves.map((leave) => (
            <ApprovalCard key={leave.id} leave={leave} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ leave }: { leave: { id: string; employeeName: string; department: string; leaveTypeName: string; startDate: string; endDate: string; totalDays: number; isHalfDay: boolean; reason: string; status: LeaveStatus; createdAt: string } }) {
  const review = useReviewLeave(leave.id);
  const [conflict, setConflict] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  function handleAction(action: "APPROVED" | "REJECTED", force?: boolean) {
    setConflict(null);
    review.mutate(
      { status: action, comment: comment || undefined, forceOverride: force || undefined },
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

  return (
    <Card className="border-l-4 border-l-amber-400 hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{leave.employeeName}</h3>
                <p className="text-xs text-muted-foreground">{leave.department}</p>
              </div>
              <Badge variant="outline" className="ml-auto text-xs">
                {leave.leaveTypeName}
                {leave.isHalfDay && " (½ day)"}
              </Badge>
            </div>
            <div className="ml-12 space-y-1.5">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {formatDate(leave.startDate)}
                  {leave.startDate !== leave.endDate && ` → ${formatDate(leave.endDate)}`}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {leave.totalDays} day{leave.totalDays !== 1 ? "s" : ""}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{leave.reason}</p>
              <p className="text-xs text-muted-foreground">
                Applied: {new Date(leave.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>

              {conflict && (
                <div className="flex items-start gap-2 mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-700">{conflict}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction("APPROVED", true)}
                      disabled={review.isPending}
                      className="mt-1 text-amber-600 hover:text-amber-700 h-7 px-2 text-xs"
                    >
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Force Approve
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                <Input
                  placeholder="Add a comment (optional)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="h-8 text-xs max-w-[280px]"
                />
                <Button
                  size="sm"
                  onClick={() => handleAction("APPROVED")}
                  disabled={review.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white h-8"
                >
                  {review.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleAction("REJECTED")}
                  disabled={review.isPending}
                  className="h-8"
                >
                  {review.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   LEAVE TYPES SECTION
   ═══════════════════════════════════════════════════ */
function LeaveTypesSection() {
  const { data: types, isLoading } = useLeaveTypes();
  const createType = useCreateLeaveType();
  const deleteType = useDeleteLeaveType();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", isPaid: true, color: "#3b82f6" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createType.mutateAsync(form);
    setForm({ name: "", code: "", isPaid: true, color: "#3b82f6" });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Leave Types</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> Add Type
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              {createType.isError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {createType.error instanceof Error ? createType.error.message : "Failed"}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Annual Leave"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. AL"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isPaid}
                      onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    Paid
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createType.isPending}>
                  {createType.isPending ? "Creating..." : "Create Type"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.code}</TableCell>
                    <TableCell>{t.isPaid ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? "success" : "secondary"}>
                        {t.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div
                        className="h-5 w-5 rounded-full border"
                        style={{ backgroundColor: t.color || "#3b82f6" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteType.mutate(t.id)}
                        disabled={deleteType.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!types || types.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No leave types configured
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Policies ───────────────────────────────────────────────────

function PoliciesSection() {
  const { data: policies, isLoading } = useLeavePolicies();
  const { data: leaveTypes } = useLeaveTypes();
  const createPolicy = useCreateLeavePolicy();
  const deletePolicy = useDeleteLeavePolicy();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    leaveTypeId: "",
    annualQuota: 21,
    monthlyAccrual: false,
    carryForward: false,
    maxCarryForwardDays: 0,
    probationRestricted: false,
    sandwichPolicy: false,
    allowHalfDay: true,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createPolicy.mutateAsync(form);
    setForm({
      leaveTypeId: "",
      annualQuota: 21,
      monthlyAccrual: false,
      carryForward: false,
      maxCarryForwardDays: 0,
      probationRestricted: false,
      sandwichPolicy: false,
      allowHalfDay: true,
    });
    setShowForm(false);
  };

  const typeNameById = (id: string) =>
    leaveTypes?.find((t) => t.id === id)?.name || id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Leave Policies</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> Add Policy
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              {createPolicy.isError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {createPolicy.error instanceof Error ? createPolicy.error.message : "Failed"}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={form.leaveTypeId}
                    onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
                    required
                  >
                    <option value="">Select type</option>
                    {leaveTypes?.map((lt) => (
                      <option key={lt.id} value={lt.id}>{lt.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Annual Quota (days)</Label>
                  <Input
                    type="number"
                    value={form.annualQuota}
                    onChange={(e) => setForm((f) => ({ ...f, annualQuota: +e.target.value }))}
                    min={0}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Carry Forward Days</Label>
                  <Input
                    type="number"
                    value={form.maxCarryForwardDays}
                    onChange={(e) => setForm((f) => ({ ...f, maxCarryForwardDays: +e.target.value }))}
                    min={0}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                {([
                  { key: "monthlyAccrual", label: "Monthly Accrual" },
                  { key: "carryForward", label: "Carry Forward" },
                  { key: "probationRestricted", label: "Probation Restricted" },
                  { key: "sandwichPolicy", label: "Sandwich Policy" },
                  { key: "allowHalfDay", label: "Allow Half Day" },
                ] as const).map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[opt.key] as boolean}
                      onChange={(e) => setForm((f) => ({ ...f, [opt.key]: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createPolicy.isPending}>
                  {createPolicy.isPending ? "Creating..." : "Create Policy"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Quota</TableHead>
                  <TableHead>Accrual</TableHead>
                  <TableHead>Carry Forward</TableHead>
                  <TableHead>Half Day</TableHead>
                  <TableHead>Sandwich</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{typeNameById(p.leaveTypeId)}</TableCell>
                    <TableCell>{p.annualQuota} days</TableCell>
                    <TableCell>{p.monthlyAccrual ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      {p.carryForward ? `Yes (${p.maxCarryForwardDays}d)` : "No"}
                    </TableCell>
                    <TableCell>{p.allowHalfDay ? "Yes" : "No"}</TableCell>
                    <TableCell>{p.sandwichPolicy ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deletePolicy.mutate(p.id)}
                        disabled={deletePolicy.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!policies || policies.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No leave policies configured
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Holidays ───────────────────────────────────────────────────

function HolidaysSection() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: holidays, isLoading } = useHolidays(year);
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", isOptional: false });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createHoliday.mutateAsync(form);
    setForm({ name: "", date: "", isOptional: false });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Company Holidays</h2>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setYear(year - 1)}>
              ←
            </Button>
            <span className="px-2 py-1 text-sm font-medium">{year}</span>
            <Button variant="outline" size="sm" onClick={() => setYear(year + 1)}>
              →
            </Button>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> Add Holiday
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              {createHoliday.isError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {createHoliday.error instanceof Error ? createHoliday.error.message : "Failed"}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Holiday Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Republic Day"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isOptional}
                      onChange={(e) => setForm((f) => ({ ...f, isOptional: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    Optional Holiday
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createHoliday.isPending}>
                  {createHoliday.isPending ? "Creating..." : "Add Holiday"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays?.map((h) => {
                  const d = new Date(h.date + "T00:00:00");
                  const dayName = d.toLocaleDateString("en-IN", { weekday: "long" });
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell>{h.date}</TableCell>
                      <TableCell>{dayName}</TableCell>
                      <TableCell>
                        <Badge variant={h.isOptional ? "outline" : "success"}>
                          {h.isOptional ? "Optional" : "Mandatory"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteHoliday.mutate(h.id)}
                          disabled={deleteHoliday.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!holidays || holidays.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No holidays for {year}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
