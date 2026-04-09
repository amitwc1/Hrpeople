"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

interface DeptData {
  department: string;
  count: number;
}

interface DepartmentWidgetProps {
  data?: DeptData[];
  total?: number;
  loading?: boolean; // eslint-disable-line @typescript-eslint/no-unused-vars
}

export function DepartmentWidget({ data, total }: DepartmentWidgetProps) {
  const items = data || [];
  const totEmp = total || items.reduce((a, c) => a + c.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.9 }}
    >
      <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Department Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((dept, i) => {
              const pct = Math.round((dept.count / totEmp) * 100);
              return (
                <motion.div
                  key={dept.department}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + i * 0.05 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${COLORS[i % COLORS.length]}`} />
                      <span className="font-medium">{dept.department}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {dept.count} ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
