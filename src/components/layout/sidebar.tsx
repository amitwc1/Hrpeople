"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { useSidebarStore } from "@/stores/dashboard-store";
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  DollarSign,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  TrendingUp,
  Briefcase,
  FileText,
  BarChart3,
  X,
  MonitorSmartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import type { Role } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"],
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        label: "Employees",
        href: "/dashboard/employees",
        icon: Users,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"],
      },
      {
        label: "Attendance",
        href: "/dashboard/attendance",
        icon: Clock,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        label: "Leave",
        href: "/dashboard/leaves",
        icon: CalendarDays,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"],
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        label: "Payroll",
        href: "/dashboard/payroll",
        icon: DollarSign,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
      },
    ],
  },
  {
    title: "Growth",
    items: [
      {
        label: "Performance",
        href: "/dashboard/performance",
        icon: TrendingUp,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"],
      },
      {
        label: "Recruitment",
        href: "/dashboard/recruitment",
        icon: Briefcase,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
      },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        label: "Documents",
        href: "/dashboard/documents",
        icon: FileText,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
        icon: BarChart3,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Sessions",
        href: "/dashboard/sessions",
        icon: MonitorSmartphone,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
      },
      {
        label: "Notifications",
        href: "/dashboard/notifications",
        icon: Bell,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { collapsed, mobileOpen, toggle, setMobileOpen } = useSidebarStore();

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => profile && item.roles.includes(profile.role)
      ),
    }))
    .filter((section) => section.items.length > 0);

  const initials =
    profile?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/50">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-blue-600/25">
                  HR
                </div>
                <div>
                  <span className="font-bold text-base tracking-tight">HR People</span>
                  <p className="text-[10px] text-muted-foreground font-medium -mt-0.5">Enterprise HRMS</p>
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-blue-600/25">
              HR
            </div>
          </Link>
        )}
        {/* Desktop toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="hidden lg:flex shrink-0 h-8 w-8 rounded-lg hover:bg-accent/80"
        >
          {collapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        {/* Mobile close */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden shrink-0 h-8 w-8 rounded-lg"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <TooltipProvider delayDuration={0}>
          <nav className="space-y-1 px-2">
            {filteredSections.map((section, si) => (
              <div key={section.title}>
                {si > 0 && <Separator className="my-3 opacity-50" />}
                {!collapsed && (
                  <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {section.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname === item.href ||
                          pathname.startsWith(item.href + "/");
                    const link = (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm dark:from-blue-950/50 dark:to-indigo-950/50 dark:text-blue-300"
                            : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-blue-600"
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 30,
                            }}
                          />
                        )}
                        <item.icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors duration-200",
                            isActive
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                        {!collapsed && item.badge !== undefined && item.badge > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right" className="font-medium">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    return link;
                  })}
                </div>
              </div>
            ))}
          </nav>
        </TooltipProvider>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-border/50 p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent/80",
            collapsed && "justify-center p-2"
          )}
        >
          <Avatar className="h-9 w-9 ring-2 ring-background shadow-sm">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {profile?.displayName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate capitalize">
                  {profile?.role?.replace("_", " ").toLowerCase()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                title="Sign out"
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border/50 bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar text-sidebar-foreground shadow-2xl lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
