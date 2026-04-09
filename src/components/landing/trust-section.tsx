"use client";

import { motion } from "framer-motion";

const COMPANIES = [
  "Acme Corp",
  "Globex Inc",
  "Initech",
  "Umbrella Co",
  "Wayne Enterprises",
  "Stark Industries",
];

export function TrustSection() {
  return (
    <section className="border-y bg-gray-50/50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground"
        >
          Trusted by leading companies
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6"
        >
          {COMPANIES.map((name) => (
            <span
              key={name}
              className="text-lg font-semibold text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
            >
              {name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
