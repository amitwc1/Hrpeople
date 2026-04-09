"use client";

import { motion } from "framer-motion";
import { Shield, Zap, HeartHandshake, Globe2 } from "lucide-react";

const REASONS = [
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description:
      "SOC 2 compliant with end-to-end encryption, role-based access control, and audit logs. Your data is safe with us.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Built on modern infrastructure for instant load times. Real-time updates powered by Firebase ensure zero lag.",
  },
  {
    icon: HeartHandshake,
    title: "Dedicated Support",
    description:
      "Our customer success team is available via chat, email, and call. Average response time under 2 hours.",
  },
  {
    icon: Globe2,
    title: "Multi-Tenant & Scalable",
    description:
      "Designed for companies of all sizes. Scale from 10 to 10,000+ employees without breaking a sweat.",
  },
];

export function WhyChooseUs() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Why Hr People
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Built for Teams That Move Fast
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              We obsess over simplicity and power so you don&apos;t have to choose
              between the two. Hr People is trusted by startups and enterprises
              alike.
            </p>
          </motion.div>

          {/* Right – 2×2 grid */}
          <div className="grid gap-6 sm:grid-cols-2">
            {REASONS.map((reason, i) => (
              <motion.div
                key={reason.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-2xl border bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <reason.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="mt-3 text-base font-semibold text-foreground">
                  {reason.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {reason.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
