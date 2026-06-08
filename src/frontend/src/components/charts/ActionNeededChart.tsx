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

export function ActionNeededChart({ data }: { data: ChartDatum[] }) {
  return (
    <ChartPanel
      title="Condition and Action Summary"
      description="MVP operational queue signals"
      isEmpty={data.every((item) => item.value === 0)}
    >
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 24, right: 12, top: 12, bottom: 12 }}
        >
          <CartesianGrid stroke="#dbe7de" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: "#5d6b62", fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tick={{ fill: "#5d6b62", fontSize: 12 }}
            tickLine={false}
          />
          <Tooltip />
          <Bar dataKey="value" fill="#1fa463" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
