"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChartCard } from "./chart-card";
import { Badge } from "@/components/ui/badge";

interface GrowthDataPoint {
  month: string;
  hires: number;
  exits: number;
}

interface EmployeeGrowthChartProps {
  data?: GrowthDataPoint[];
  loading?: boolean;
}

export function EmployeeGrowthChart({ data, loading }: EmployeeGrowthChartProps) {
  const chartData = data || [];

  return (
    <ChartCard
      title="Employee Growth"
      subtitle="Monthly hiring and exit trend"
      loading={loading}
      delay={6}
      action={
        <Badge variant="secondary" className="text-[11px] font-medium">
          12 Months
        </Badge>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
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
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <RTooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              fontSize: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey="hires"
            stroke="#22c55e"
            strokeWidth={2.5}
            dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }}
            activeDot={{ r: 6, strokeWidth: 2 }}
            name="Hires"
          />
          <Line
            type="monotone"
            dataKey="exits"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }}
            activeDot={{ r: 6, strokeWidth: 2 }}
            name="Exits"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          Hires
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Exits
        </div>
      </div>
    </ChartCard>
  );
}
