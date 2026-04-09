"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChartCard } from "./chart-card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp } from "lucide-react";

interface PayrollSummaryData {
  totalThisMonth: number;
  avgSalary: number;
  trend: { month: string; amount: number }[];
}

interface PayrollWidgetProps {
  data?: PayrollSummaryData;
  loading?: boolean;
}

export function PayrollWidget({ data, loading }: PayrollWidgetProps) {
  const d = data || { totalThisMonth: 0, avgSalary: 0, trend: [] };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <ChartCard
      title="Payroll Summary"
      subtitle="Monthly payroll cost trend"
      loading={loading}
      delay={5}
      action={
        <Badge variant="secondary" className="text-[11px] font-medium">
          6 Months
        </Badge>
      }
    >
      {/* Quick metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="text-sm font-bold">{formatCurrency(d.totalThisMonth)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg. Salary</p>
            <p className="text-sm font-bold">{formatCurrency(d.avgSalary)}</p>
          </div>
        </div>
      </div>

      {/* Area chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={d.trend}>
          <defs>
            <linearGradient id="payrollGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
          />
          <RTooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              fontSize: "12px",
            }}
            formatter={(v) => [formatCurrency(Number(v)), "Payroll"]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#payrollGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
