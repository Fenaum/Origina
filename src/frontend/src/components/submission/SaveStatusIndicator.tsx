import type { SaveStatus } from "@/types/submission";

export function SaveStatusIndicator({
  status,
  lastSavedAt,
}: {
  status: SaveStatus;
  lastSavedAt: string | null;
}) {
  const label =
    status === "saving"
      ? "Saving..."
      : status === "error"
        ? "Save failed"
        : lastSavedAt
          ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}`
          : "Not saved yet";

  return <div className={`save-status ${status}`}>{label}</div>;
}
