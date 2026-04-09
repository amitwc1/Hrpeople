"use client";

import { motion } from "framer-motion";
import {
  Users,
  Clock,
  CalendarDays,
  Wallet,
  BarChart3,
  BriefcaseBusiness,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Employee Management",
    description:
      "Centralize employee records, documents, and org charts. Manage onboarding and offboarding with automated workflows.",
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    icon: Clock,
    title: "Attendance Tracking",
    description:
      "Real-time clock-in/out with GPS verification, shift management, and overtime calculations. Never miss a beat.",
    color: "from-green-500 to-emerald-600",
    bgColor: "bg-green-50",
    iconColor: "text-green-600",
  },
  {
    icon: CalendarDays,
    title: "Leave Management",
    description:
      "Streamlined leave requests with approval workflows, balance tracking, and holiday calendars for your team.",
    color: "from-amber-500 to-orange-600",
    bgColor: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    icon: Wallet,
    title: "Payroll Processing",
    description:
      "Automated salary calculations with tax deductions, bonus management, and one-click payslip generation.",
    color: "from-purple-500 to-purple-600",
    bgColor: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description:
      "Insightful dashboards with headcount trends, attrition reports, department analytics, and exportable data.",
    color: "from-pink-500 to-rose-600",
    bgColor: "bg-pink-50",
    iconColor: "text-pink-600",
  },
  {
    icon: BriefcaseBusiness,
    title: "Recruitment",
    description:
      "Post jobs, track applicants, schedule interviews, and manage the entire hiring pipeline in one place.",
    color: "from-indigo-500 to-indigo-600",
    bgColor: "bg-indigo-50",
    iconColor: "text-indigo-600",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Features
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything You Need to Manage HR
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A comprehensive suite of tools designed to simplify every aspect of
            human resource management for modern teams.
          </p>
        </motion.div>

        {/* Cards grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.title}
              variants={item}
              className="group relative rounded-2xl border bg-white p-6 transition-all hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5"
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bgColor}`}
              >
                <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
              {/* Subtle gradient border on hover */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100 ring-1 ring-blue-500/10" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
