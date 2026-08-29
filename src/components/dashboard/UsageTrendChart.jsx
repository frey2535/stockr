import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";

// Shows daily usage (sum of 'use' + 'shrink' transaction quantities) for the
// last 30 days. Reuses the transactions data passed from the parent — no new
// API calls.
export default function UsageTrendChart({ transactions = [] }) {
  const data = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      days.push({ date: key, label: format(d, "MMM d"), usage: 0, shrink: 0 });
    }
    const byDay = {};
    days.forEach(d => { byDay[d.date] = d; });
    transactions.forEach(t => {
      if (t.type !== "use" && t.type !== "shrink") return;
      const day = format(parseISO(t.created_date), "yyyy-MM-dd");
      if (byDay[day]) {
        if (t.type === "use") byDay[day].usage += (t.quantity || 0);
        else byDay[day].shrink += (t.quantity || 0);
      }
    });
    return days;
  }, [transactions]);

  const totalUsage = data.reduce((s, d) => s + d.usage, 0);
  const totalShrink = data.reduce((s, d) => s + d.shrink, 0);

  if (totalUsage === 0 && totalShrink === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-secondary" />
          Usage Trend — Last 30 Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={6} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(l) => `Date: ${l}`}
              />
              <Bar dataKey="usage" name="Used" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="shrink" name="Shrinkage" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />Used: {totalUsage}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" />Shrinkage: {totalShrink}</span>
        </div>
      </CardContent>
    </Card>
  );
}