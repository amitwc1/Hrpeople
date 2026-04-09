"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChartCard } from "./chart-card";
import { Badge } from "@/components/ui/badge";

interface AttendanceDataPoint {
  day: string;
  present: number;
  absent: number;
  leave: number;
}

interface AttendanceWidgetProps {
  data?: AttendanceDataPoint[];
  loading?: boolean;
}

export function AttendanceWidget({ data, loading }: AttendanceWidgetProps) {
  const chartData = data || [];

  return (
    <ChartCard
      title="Attendance Overview"
      subtitle="This week's attendance breakdown"
      loading={loading}
      delay={3}
      action={
        <Badge variant="secondary" className="text-[11px] font-medium">
          This Week
        </Badge>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} barGap={4} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="day"
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
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="present" fill="#22c55e" radius={[6, 6, 0, 0]} name="Present" />
          <Bar dataKey="absent" fill="#ef4444" radius={[6, 6, 0, 0]} name="Absent" />
          <Bar dataKey="leave" fill="#f59e0b" radius={[6, 6, 0, 0]} name="On Leave" />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 pt-2">
        {[
          { label: "Present", color: "bg-green-500" },
          { label: "Absent", color: "bg-red-500" },
          { label: "On Leave", color: "bg-amber-500" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
            {item.label}
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
