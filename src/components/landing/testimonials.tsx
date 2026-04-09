"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "Hr People transformed our HR operations. What used to take hours now takes minutes. The attendance and payroll integration is seamless.",
    name: "Priya Sharma",
    role: "HR Director, TechVista Solutions",
    initials: "PS",
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    quote:
      "We switched from spreadsheets to Hr People and never looked back. The leave management alone saved us 20 hours per month.",
    name: "Rahul Mehta",
    role: "COO, GreenLeaf Innovations",
    initials: "RM",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    quote:
      "The dashboard gives me a real-time pulse of the entire organization. Best HR platform we've used — and we've tried them all.",
    name: "Ananya Reddy",
    role: "CEO, NexGen Studios",
    initials: "AR",
    gradient: "from-amber-500 to-orange-500",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Testimonials
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Loved by HR Teams Everywhere
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex flex-col rounded-2xl border bg-white p-6 transition-shadow hover:shadow-lg"
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star
                    key={si}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="mt-6 flex items-center gap-3 border-t pt-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-xs font-bold text-white`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
