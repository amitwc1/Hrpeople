"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { UpcomingEvents } from "./upcoming-events";
import type { ManagerDashboardData, DashboardStats } from "@/types";

interface ManagerDashboardProps {
  data?: ManagerDashboardData;
  events?: DashboardStats["upcomingEvents"];
  loading?: boolean;
}

export function ManagerDashboard({ data, events, loading }: ManagerDashboardProps) {
  const router = useRouter();

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const d = data;

  return (
    <div className="space-y-6">
      {/* Team Overview Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Team Size", value: d.teamSize, icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50" },
          { label: "Present Today", value: d.teamPresent, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" },
          { label: "On Leave", value: d.teamOnLeave, icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <Card className="border-border/50 hover:shadow-lg hover:shadow-black/5 transition-all duration-300">
              <CardContent className="flex items-center gap-4 py-5">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", s.color)}>
                  <s.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Pending Approvals
                </CardTitle>
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  {d.pendingApprovals.length} pending
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {d.pendingApprovals.map((req, i) => {
                  const initials = req.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("");
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.05 }}
                      className="flex items-center gap-3 rounded-xl border border-border/50 p-3 hover:bg-muted/30 transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 text-xs font-bold dark:from-blue-900 dark:to-indigo-900 dark:text-blue-300">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{req.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {req.type} · {req.days}d · {new Date(req.from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {req.from !== req.to && ` – ${new Date(req.to).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:hover:bg-emerald-950"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <Button
                variant="outline"
                className="w-full mt-4 rounded-xl"
                onClick={() => router.push("/dashboard/leaves")}
              >
                View All Requests
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Attendance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Team Attendance
                </CardTitle>
                <Badge variant="secondary" className="text-[11px]">
                  Today
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[320px]">
                <div className="space-y-0">
                  {d.teamMembers.map((member, i) => {
                    const initials = member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("");
                    const isPresent = member.status === "present";
                    return (
                      <motion.div
                        key={member.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 + i * 0.03 }}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-[10px] bg-muted">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                              isPresent ? "bg-emerald-500" : "bg-amber-500"
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {isPresent ? `In at ${member.checkIn}` : "On Leave"}
                          </p>
                        </div>
                        {isPresent ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming Events */}
      <UpcomingEvents events={events} />
    </div>
  );
}
