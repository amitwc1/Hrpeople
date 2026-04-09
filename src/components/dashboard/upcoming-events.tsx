"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Cake, PartyPopper } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface UpcomingEvent {
  id: string;
  type: "holiday" | "birthday" | "anniversary";
  title: string;
  date: string;
  daysAway: number;
}



const EVENT_CONFIG = {
  holiday: { icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/50", badge: "Holiday" },
  birthday: { icon: Cake, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-950/50", badge: "Birthday" },
  anniversary: { icon: PartyPopper, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/50", badge: "Work Anniversary" },
};

interface UpcomingEventsProps {
  events?: UpcomingEvent[];
  loading?: boolean;
}

export function UpcomingEvents({ events }: UpcomingEventsProps) {
  const items = events || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 1.0 }}
    >
      <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((event, i) => {
              const config = EVENT_CONFIG[event.type];
              const Icon = config.icon;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.0 + i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", config.bg)}>
                    <Icon className={cn("h-5 w-5", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        weekday: "short",
                      })}
                    </p>
                  </div>
                  <Badge
                    variant={event.daysAway <= 3 ? "default" : "secondary"}
                    className="text-[10px] shrink-0"
                  >
                    {event.daysAway === 0
                      ? "Today"
                      : event.daysAway === 1
                        ? "Tomorrow"
                        : `${event.daysAway}d`}
                  </Badge>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
