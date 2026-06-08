import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartPanel } from "@/components/charts/ChartPanel";
import type { ChartDatum } from "@/types/loan";

export function StatusCountChart({ data }: { data: ChartDatum[] }) {
  return (
    <ChartPanel
      title="Loan Count by Status"
      description="Active file distribution"
      isEmpty={data.every((item) => item.value === 0)}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: -20, right: 8, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="#dbe7de" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(31, 164, 99, 0.08)" }} />
          <Bar dataKey="value" fill="#1fa463" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
