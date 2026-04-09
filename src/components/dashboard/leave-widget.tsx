"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { ChartCard } from "./chart-card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, CalendarClock, CalendarX } from "lucide-react";

interface LeaveBreakdownData {
  pending: number;
  approved: number;
  rejected: number;
  chart: { name: string; value: number; color: string }[];
}

interface LeaveWidgetProps {
  data?: LeaveBreakdownData;
  loading?: boolean;
}

export function LeaveWidget({ data, loading }: LeaveWidgetProps) {
  const d = data || { pending: 0, approved: 0, rejected: 0, chart: [] };

  const stats = [
    { label: "Pending", value: d.pending, icon: CalendarClock, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50" },
    { label: "Approved", value: d.approved, icon: CalendarCheck, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" },
    { label: "Rejected", value: d.rejected, icon: CalendarX, color: "text-red-600 bg-red-50 dark:bg-red-950/50" },
  ];

  return (
    <ChartCard
      title="Leave Summary"
      subtitle="Current month leave overview"
      loading={loading}
      delay={4}
      action={
        <Badge variant="secondary" className="text-[11px] font-medium">
          This Month
        </Badge>
      }
    >
      <div className="flex items-center gap-6">
        {/* Donut chart */}
        <div className="relative flex-shrink-0">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={d.chart}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {d.chart.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <RTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">
              {d.chart.reduce((a, c) => a + c.value, 0)}
            </span>
            <span className="text-[10px] text-muted-foreground">Total</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border/50 mt-4">
        {d.chart.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
