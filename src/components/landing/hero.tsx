"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";

const HERO_POINTS = [
  "No credit card required",
  "14-day free trial",
  "Setup in 5 minutes",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-purple-500/3 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border bg-white/60 px-4 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Trusted by 500+ companies worldwide
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Manage Your Entire Workforce{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              in One Powerful Platform
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            From attendance tracking to payroll processing, Hr People streamlines
            every aspect of HR management so you can focus on what matters most
            — your people.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
            >
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base"
              asChild
            >
              <a href="#how-it-works">
                <Play className="mr-2 h-4 w-4" />
                See How It Works
              </a>
            </Button>
          </motion.div>

          {/* Trust points */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            {HERO_POINTS.map((point) => (
              <span
                key={point}
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {point}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="relative mt-16 sm:mt-20"
        >
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-white shadow-2xl shadow-blue-500/10">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b bg-gray-50/80 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="ml-4 flex-1 rounded-md bg-white px-3 py-1 text-xs text-muted-foreground border">
                app.hrpeople.com/dashboard
              </div>
            </div>
            {/* Mock dashboard content */}
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Total Employees", value: "247", color: "bg-blue-500" },
                  { label: "Present Today", value: "231", color: "bg-green-500" },
                  { label: "On Leave", value: "12", color: "bg-amber-500" },
                  { label: "Open Positions", value: "8", color: "bg-purple-500" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border p-4">
                    <div className={`mb-2 h-2 w-8 rounded-full ${stat.color}/20`} />
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="col-span-2 rounded-xl border p-4">
                  <p className="text-sm font-medium text-foreground mb-3">Attendance Overview</p>
                  <div className="flex items-end gap-1.5 h-24">
                    {[65, 80, 72, 90, 85, 95, 78].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-blue-500 to-indigo-400" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm font-medium text-foreground mb-3">Departments</p>
                  <div className="space-y-2">
                    {["Engineering", "Design", "Marketing", "Sales"].map((d) => (
                      <div key={d} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{d}</span>
                        <div className="h-2 w-16 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.random() * 40 + 60}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Glow effect */}
          <div className="pointer-events-none absolute -bottom-20 left-1/2 -translate-x-1/2 h-40 w-3/4 bg-gradient-to-t from-blue-500/10 to-transparent blur-2xl" />
        </motion.div>
      </div>
    </section>
  );
}
