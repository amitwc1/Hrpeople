"use client";

import { useDashboard, useEmployeeDashboard, useManagerDashboard } from "@/hooks/use-dashboard";
import { useAuth } from "@/lib/auth/auth-context";
import {
  KPICard,
  AttendanceWidget,
  LeaveWidget,
  PayrollWidget,
  EmployeeGrowthChart,
  ActivityFeed,
  QuickActions,
  DepartmentWidget,
  UpcomingEvents,
  EmployeeDashboard,
  ManagerDashboard,
} from "@/components/dashboard";
import {
  Users,
  UserCheck,
  CalendarOff,
  DollarSign,
} from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { profile } = useAuth();
  const greeting = getGreeting();
  const firstName = profile?.displayName?.split(" ")[0] || "User";

  // ─── Employee view ───
  if (profile?.role === "EMPLOYEE") {
    return <EmployeeView greeting={greeting} name={firstName} />;
  }

  // ─── Manager view ───
  if (profile?.role === "MANAGER") {
    return <ManagerView greeting={greeting} name={firstName} />;
  }

  // ─── Admin view ───
  return <AdminView greeting={greeting} name={firstName} />;
}

function EmployeeView({ greeting, name }: { greeting: string; name: string }) {
  const { data, isLoading } = useEmployeeDashboard();
  return (
    <div className="space-y-6">
      <DashboardHeader greeting={greeting} name={name} subtitle="Here's your daily overview" />
      <EmployeeDashboard data={data} loading={isLoading} />
    </div>
  );
}

function ManagerView({ greeting, name }: { greeting: string; name: string }) {
  const { data, isLoading } = useManagerDashboard();
  return (
    <div className="space-y-6">
      <DashboardHeader greeting={greeting} name={name} subtitle="Manage your team at a glance" />
      <ManagerDashboard data={data} loading={isLoading} />
    </div>
  );
}

function AdminView({ greeting, name }: { greeting: string; name: string }) {
  const { data, isLoading } = useDashboard();

  const formatCurrency = (v: number) =>
    `₹${v.toLocaleString("en-IN")}`;

  const kpis = [
    {
      title: "Total Employees",
      value: data?.totalEmployees ?? 0,
      icon: Users,
      gradient: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30",
      iconColor: "text-blue-600",
    },
    {
      title: "Present Today",
      value: data?.presentToday ?? 0,
      icon: UserCheck,
      gradient: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30",
      iconColor: "text-emerald-600",
    },
    {
      title: "On Leave Today",
      value: data?.onLeaveToday ?? 0,
      icon: CalendarOff,
      gradient: "bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/50 dark:to-orange-900/30",
      iconColor: "text-amber-600",
    },
    {
      title: "Payroll Cost",
      value: data?.payrollSummary ? formatCurrency(data.payrollSummary.totalThisMonth) : "₹0",
      subtitle: "This month",
      icon: DollarSign,
      gradient: "bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/50 dark:to-violet-900/30",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        greeting={greeting}
        name={name}
        subtitle="Here's what's happening in your organization today"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KPICard key={kpi.title} {...kpi} loading={isLoading} delay={i} />
        ))}
      </div>

      {/* Charts Row 1: Attendance + Leave */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AttendanceWidget data={data?.attendanceWeek} loading={isLoading} />
        <LeaveWidget data={data?.leaveBreakdown} loading={isLoading} />
      </div>

      {/* Charts Row 2: Payroll + Employee Growth */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PayrollWidget data={data?.payrollSummary} loading={isLoading} />
        <EmployeeGrowthChart data={data?.employeeGrowth} loading={isLoading} />
      </div>

      {/* Bottom Row: Activity + Quick Actions + Department + Events */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ActivityFeed activities={data?.activityFeed} loading={isLoading} />
        </div>
        <div className="lg:col-span-3 space-y-6">
          <QuickActions />
          <UpcomingEvents events={data?.upcomingEvents} />
        </div>
        <div className="lg:col-span-4">
          <DepartmentWidget
            data={data?.departmentDistribution}
            total={data?.totalEmployees}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function DashboardHeader({
  greeting,
  name,
  subtitle,
}: {
  greeting: string;
  name: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          {greeting}, {name} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
      </div>
      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
    </motion.div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
