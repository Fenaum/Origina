export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "warning";
  href?: string;
};

export type StatusItem = {
  label: string;
  value: string;
  meta: string;
};
