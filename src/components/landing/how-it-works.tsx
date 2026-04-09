"use client";

import { motion } from "framer-motion";
import { UserPlus, Settings2, Rocket } from "lucide-react";

const STEPS = [
  {
    icon: UserPlus,
    step: "01",
    title: "Create Your Account",
    description:
      "Sign up in seconds. Set up your company profile, departments, and organizational structure.",
  },
  {
    icon: Settings2,
    step: "02",
    title: "Configure & Import",
    description:
      "Customize leave policies, attendance rules, and payroll settings. Import your employee data seamlessly.",
  },
  {
    icon: Rocket,
    step: "03",
    title: "Go Live",
    description:
      "Invite your team and start managing HR operations effortlessly. See results from day one.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-gray-50/50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            How It Works
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Up and Running in Minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Getting started with Hr People is simple. Three steps and your team
            is ready to go.
          </p>
        </motion.div>

        <div className="relative mt-16 grid gap-8 sm:grid-cols-3">
          {/* Connector line */}
          <div className="pointer-events-none absolute top-16 left-0 right-0 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent sm:block" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25">
                <step.icon className="h-7 w-7 text-white" />
              </div>
              <span className="mt-4 text-xs font-bold uppercase tracking-widest text-blue-600">
                Step {step.step}
              </span>
              <h3 className="mt-2 text-xl font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
