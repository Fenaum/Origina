import { ActionNeededChart } from "@/components/charts/ActionNeededChart";
import { ChannelCountChart } from "@/components/charts/ChannelCountChart";
import { MonthlySubmissionTrendChart } from "@/components/charts/MonthlySubmissionTrendChart";
import { StatusAmountChart } from "@/components/charts/StatusAmountChart";
import { StatusCountChart } from "@/components/charts/StatusCountChart";
import {
  buildActionNeededData,
  buildChannelCountData,
  buildMonthlySubmissionData,
  buildStatusAmountData,
  buildStatusCountData,
} from "@/data/pipelineAnalytics";
import type { LoanSummary } from "@/types/loan";

export function PipelineCharts({ loans }: { loans: LoanSummary[] }) {
  return (
    <section className="chart-grid" aria-label="Pipeline visual analytics">
      <StatusCountChart data={buildStatusCountData(loans)} />
      <StatusAmountChart data={buildStatusAmountData(loans)} />
      <ChannelCountChart data={buildChannelCountData(loans)} />
      <ActionNeededChart data={buildActionNeededData(loans)} />
      <div className="chart-grid-wide">
        <MonthlySubmissionTrendChart data={buildMonthlySubmissionData(loans)} />
      </div>
    </section>
  );
}
