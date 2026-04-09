"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  gradient: string; // tailwind gradient classes for icon bg
  iconColor: string;
  loading?: boolean;
  delay?: number;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  gradient,
  iconColor,
  loading,
  delay = 0,
}: KPICardProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-12 w-12 rounded-2xl" />
        </div>
      </Card>
    );
  }

  const TrendIcon =
    trend && trend.value > 0
      ? TrendingUp
      : trend && trend.value < 0
        ? TrendingDown
        : Minus;

  const trendColor =
    trend && trend.value > 0
      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
      : trend && trend.value < 0
        ? "text-red-600 bg-red-50 dark:bg-red-950/50"
        : "text-muted-foreground bg-muted";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1, ease: "easeOut" }}
    >
      <Card className="group relative overflow-hidden p-6 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 border-border/50">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-muted/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
            </div>
            {trend && (
              <div className="flex items-center gap-1.5 pt-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                    trendColor
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {trend.label}
                </span>
              </div>
            )}
            {subtitle && !trend && (
              <p className="text-[11px] text-muted-foreground pt-1">{subtitle}</p>
            )}
          </div>

          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110",
              gradient
            )}
          >
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
