"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import {
  UserPlus,
  DollarSign,
  CalendarPlus,
  Clock,
  FileText,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface QuickAction {
  label: string;
  icon: LucideIcon;
  href: string;
  gradient: string;
  roles: Role[];
}

const ACTIONS: QuickAction[] = [
  {
    label: "Add Employee",
    icon: UserPlus,
    href: "/dashboard/employees?action=add",
    gradient: "from-blue-500 to-blue-600",
    roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    label: "Run Payroll",
    icon: DollarSign,
    href: "/dashboard/payroll?action=run",
    gradient: "from-emerald-500 to-emerald-600",
    roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    label: "Apply Leave",
    icon: CalendarPlus,
    href: "/dashboard/leaves?action=apply",
    gradient: "from-amber-500 to-orange-500",
    roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"],
  },
  {
    label: "Mark Attendance",
    icon: Clock,
    href: "/dashboard/attendance?action=checkin",
    gradient: "from-purple-500 to-purple-600",
    roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"],
  },
  {
    label: "View Reports",
    icon: BarChart3,
    href: "/dashboard/reports",
    gradient: "from-pink-500 to-rose-500",
    roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    label: "Documents",
    icon: FileText,
    href: "/dashboard/documents",
    gradient: "from-cyan-500 to-teal-500",
    roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"],
  },
];

export function QuickActions() {
  const router = useRouter();
  const { profile } = useAuth();

  const filtered = ACTIONS.filter(
    (a) => profile && a.roles.includes(profile.role)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 }}
    >
      <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + i * 0.05 }}
              >
                <Button
                  variant="outline"
                  className={cn(
                    "group relative h-auto w-full flex-col gap-2 rounded-xl border-border/50 py-4 hover:border-transparent hover:shadow-md transition-all duration-300"
                  )}
                  onClick={() => router.push(action.href)}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform duration-300 group-hover:scale-110",
                      action.gradient
                    )}
                  >
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium">{action.label}</span>
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
