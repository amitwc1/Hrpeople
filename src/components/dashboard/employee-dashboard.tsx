"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  CalendarDays,
  Clock,
  DollarSign,
  FileText,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { UpcomingEvents } from "./upcoming-events";
import type { EmployeeDashboardData, DashboardStats } from "@/types";

interface EmployeeDashboardProps {
  data?: EmployeeDashboardData;
  events?: DashboardStats["upcomingEvents"];
  loading?: boolean;
}

export function EmployeeDashboard({ data, events, loading }: EmployeeDashboardProps) {
  const router = useRouter();

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const d = data;

  const isPresent = d.todayStatus === "Present";
  const statusColor =
    isPresent
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";

  return (
    <div className="space-y-6">
      {/* Today's Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className={cn("border-2", statusColor)}>
          <CardContent className="flex items-center gap-6 py-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 dark:bg-black/20 shadow-sm">
              {isPresent ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              ) : (
                <CalendarDays className="h-7 w-7 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">
                  You&apos;re {d.todayStatus} Today
                </h3>
                <Badge variant="secondary" className="text-[10px]">
                  {d.todayStatus}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm mt-1">
                {d.checkInTime && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Checked in: {d.checkInTime}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Working: {d.workingHours}
                </span>
              </div>
            </div>
            <Button
              className="rounded-xl"
              onClick={() => router.push("/dashboard/attendance")}
            >
              View Attendance
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Leave Balances */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Leave Balance</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs rounded-lg"
                onClick={() => router.push("/dashboard/leaves")}
              >
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {d.leaveBalances.map((bal, i) => {
                const pct = Math.round((bal.used / bal.total) * 100);
                return (
                  <motion.div
                    key={bal.type}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                    className="rounded-xl border border-border/50 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bal.color }} />
                      <span className="text-xs font-medium text-muted-foreground">
                        {bal.type}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-bold">
                        {bal.total - bal.used}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        / {bal.total} left
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {bal.used} used
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Payslip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Payslip</CardTitle>
            </CardHeader>
            <CardContent>
              {d.recentPayslip ? (
                <>
                  <div className="flex items-center gap-4 rounded-xl border border-border/50 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50">
                      <DollarSign className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{d.recentPayslip.month}</p>
                      <p className="text-2xl font-bold">
                        ₹{d.recentPayslip.netPay.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                        {d.recentPayslip.status}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(d.recentPayslip.paidDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4 rounded-xl"
                    onClick={() => router.push("/dashboard/payroll")}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Payslip
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No payslip available yet</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendance Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Attendance This Month
                </CardTitle>
                <Badge variant="secondary" className="text-[11px]">
                  {d.attendanceSummary.present}/{d.attendanceSummary.totalDays} days
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Present", value: d.attendanceSummary.present, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" },
                  { label: "Absent", value: d.attendanceSummary.absent, icon: CalendarDays, color: "text-red-600 bg-red-50 dark:bg-red-950/50" },
                  { label: "On Leave", value: d.attendanceSummary.leave, icon: CalendarCheck, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50" },
                  { label: "Half Day", value: d.attendanceSummary.halfDay, icon: Clock, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/50" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-3 rounded-xl border border-border/50 p-3"
                  >
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", s.color)}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming Events */}
      <UpcomingEvents events={events} />
    </div>
  );
}
