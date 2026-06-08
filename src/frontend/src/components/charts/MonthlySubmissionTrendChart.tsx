import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartPanel } from "@/components/charts/ChartPanel";
import type { MonthlySubmissionDatum } from "@/types/loan";

export function MonthlySubmissionTrendChart({
  data,
}: {
  data: MonthlySubmissionDatum[];
}) {
  return (
    <ChartPanel
      title="Monthly Submission Trend"
      description="Mock submission count by month"
      isEmpty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ left: -20, right: 12, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="#dbe7de" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="submissions"
            stroke="#0d6b3b"
            strokeWidth={3}
            dot={{ fill: "#1fa463", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
