"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarPlus,
  UserPlus,
  DollarSign,
  Clock,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  type: "leave" | "employee" | "payroll" | "attendance" | "approval";
  message: string;
  user: string;
  time: string;
}

const ICON_MAP: Record<Activity["type"], { icon: LucideIcon; color: string; bg: string }> = {
  leave: { icon: CalendarPlus, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/50" },
  employee: { icon: UserPlus, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/50" },
  payroll: { icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
  attendance: { icon: Clock, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/50" },
  approval: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/50" },
};



interface ActivityFeedProps {
  activities?: Activity[];
  loading?: boolean;
}

export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  const items = activities || [];

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
    >
      <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <Badge variant="secondary" className="text-[11px]">
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="space-y-0">
              {items.map((activity, i) => {
                const { icon: Icon, color, bg } = ICON_MAP[activity.type];
                const initials = activity.user
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group flex items-start gap-3 px-6 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", bg)}>
                      <Icon className={cn("h-4 w-4", color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[8px] bg-muted">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {activity.user}
                        </span>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                        {activity.message}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap pt-0.5">
                      {activity.time}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  );
}
