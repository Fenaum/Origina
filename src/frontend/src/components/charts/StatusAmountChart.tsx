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

const compactCurrency = new Intl.NumberFormat("en-US", {
  notation: "compact",
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
});

function formatCurrencyValue(value: unknown) {
  return compactCurrency.format(Number(value ?? 0));
}

export function StatusAmountChart({ data }: { data: ChartDatum[] }) {
  return (
    <ChartPanel
      title="Volume by Status"
      description="Total loan amount grouped by status"
      isEmpty={data.every((item) => item.value === 0)}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: -4, right: 8, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="#dbe7de" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
          <YAxis
            tick={{ fill: "#5d6b62", fontSize: 12 }}
            tickFormatter={(value: number) => compactCurrency.format(value)}
            tickLine={false}
          />
          <Tooltip formatter={formatCurrencyValue} />
          <Bar dataKey="value" fill="#0d6b3b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
