import { useState } from "react";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { FieldInfoPanel } from "@/components/loans/workspace/FieldInfoPanel";
import { FieldHistoryPanel } from "@/components/loans/workspace/FieldHistoryPanel";
import type { FieldMeta } from "@/components/loans/workspace/FieldInfoPanel";

export type { FieldMeta };

type CtxState = { x: number; y: number } | null;
type PanelState = "info" | "history" | null;

type Props = {
  loanId: string;
  meta: FieldMeta;
  children: React.ReactNode;
};

/**
 * Wraps any workspace field. Right-clicking opens a context menu with
 * "Field Info" and "Show Field History" options.
 */
export function WorkspaceFieldContextMenu({ loanId, meta, children }: Props) {
  const [ctx,   setCtx]   = useState<CtxState>(null);
  const [panel, setPanel] = useState<PanelState>(null);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY });
    setPanel(null);
  }

  return (
    <>
      <div
        className="wfc-wrapper"
        onContextMenu={handleContextMenu}
        data-field-key={meta.apiKey}
      >
        {children}
      </div>

      {ctx && panel === null && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          onClose={() => setCtx(null)}
          items={[
            {
              id: "field-info",
              label: "Field Info",
              icon: "🔍",
              onClick: () => { setPanel("info"); },
            },
            {
              id: "field-history",
              label: "Show Field History",
              icon: "📜",
              onClick: () => { setPanel("history"); },
            },
            { id: "sep", separator: true },
            {
              id: "copy",
              label: "Copy Field Key",
              icon: "📋",
              onClick: () => { void navigator.clipboard.writeText(meta.apiKey); },
            },
          ]}
        />
      )}

      {panel === "info" && (
        <FieldInfoPanel
          meta={meta}
          onClose={() => { setPanel(null); setCtx(null); }}
          onShowHistory={() => setPanel("history")}
        />
      )}

      {panel === "history" && (
        <FieldHistoryPanel
          loanId={loanId}
          meta={meta}
          onClose={() => { setPanel(null); setCtx(null); }}
          onBackToInfo={() => setPanel("info")}
        />
      )}
    </>
  );
}
