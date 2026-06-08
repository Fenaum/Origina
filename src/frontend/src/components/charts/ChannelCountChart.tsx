import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChartPanel } from "@/components/charts/ChartPanel";
import type { ChartDatum } from "@/types/loan";

const colors = ["#1fa463", "#0d6b3b", "#91c7a2", "#5d6b62"];

export function ChannelCountChart({ data }: { data: ChartDatum[] }) {
  return (
    <ChartPanel
      title="Loan Count by Channel"
      description="Source mix across mock files"
      isEmpty={data.length === 0}
    >
      <div className="donut-layout">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
            >
              {data.map((item, index) => (
                <Cell key={item.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          {data.map((item, index) => (
            <div key={item.name}>
              <span style={{ background: colors[index % colors.length] }} />
              <strong>{item.name}</strong>
              <small>{item.value} loans</small>
            </div>
          ))}
        </div>
      </div>
    </ChartPanel>
  );
}
