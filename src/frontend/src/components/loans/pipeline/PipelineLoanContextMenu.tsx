import { useState } from "react";
import { useRouter } from "next/router";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { QuickLoanInfoCard } from "@/components/loans/pipeline/QuickLoanInfoCard";
import { MoveTenantModal } from "@/components/loans/pipeline/MoveTenantModal";
import { DeleteLoanModal } from "@/components/loans/pipeline/DeleteLoanModal";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";
import type { SandboxOut } from "@/types/api";

type Props = {
  loan: LoanSummary;
  x: number;
  y: number;
  onClose: () => void;
  onLoanMutated?: () => void;
};

type ActiveModal = "quickInfo" | "moveTenant" | "delete" | null;

export function PipelineLoanContextMenu({ loan, x, y, onClose, onLoanMutated }: Props) {
  const router = useRouter();
  const { token, user } = useAuth();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const canMoveTenant = user?.role === "account_executive";
  const canDelete     = user?.role === "account_executive";

  async function handleSandbox() {
    if (!token) return;
    setSandboxLoading(true);
    try {
      const result = await apiRequest<SandboxOut>(`/loans/${loan.id}/sandbox`, {
        method: "POST",
        token,
      });
      // TODO: Open sandbox URL in new tab when real sandbox is provisioned
      alert(`Sandbox: ${result.message}\n\nURL (future): ${result.url}`);
    } catch (e) {
      alert(`Could not open sandbox: ${(e as Error).message}`);
    } finally {
      setSandboxLoading(false);
      onClose();
    }
  }

  const menuItems = [
    {
      id: "open",
      label: "Open Loan File",
      icon: "📂",
      onClick: () => { void router.push(`/loans/${loan.id}`); onClose(); },
    },
    {
      id: "sandbox",
      label: sandboxLoading ? "Opening…" : "Open in Sandbox",
      icon: "🧪",
      disabled: sandboxLoading,
      disabledReason: sandboxLoading ? "Loading…" : undefined,
      onClick: handleSandbox,
    },
    {
      id: "quick-info",
      label: "Quick Info",
      icon: "ℹ️",
      closeOnClick: false,
      onClick: () => setActiveModal("quickInfo"),
    },
    { id: "sep1", separator: true as const },
    {
      id: "conditions",
      label: "View Conditions",
      icon: "📋",
      onClick: () => { void router.push(`/loans/${loan.id}?section=conditions`); onClose(); },
    },
    {
      id: "notes",
      label: "Add Note",
      icon: "✏️",
      onClick: () => { void router.push(`/loans/${loan.id}?section=conversation`); onClose(); },
    },
    {
      id: "copy",
      label: "Copy Loan #",
      icon: "📋",
      onClick: () => { void navigator.clipboard.writeText(loan.loanNumber); onClose(); },
    },
    { id: "sep2", separator: true as const },
    {
      id: "move-tenant",
      label: "Move to Tenant",
      icon: "🏢",
      disabled: !canMoveTenant,
      disabledReason: canMoveTenant ? undefined : "Requires Account Executive or higher",
      closeOnClick: false,
      onClick: () => setActiveModal("moveTenant"),
    },
    {
      id: "archive",
      label: "Archive Loan",
      icon: "🗑️",
      destructive: true,
      disabled: !canDelete,
      disabledReason: canDelete ? undefined : "Requires Account Executive or IT Admin",
      closeOnClick: false,
      onClick: () => setActiveModal("delete"),
    },
  ];

  return (
    <>
      {activeModal !== "quickInfo" && (
        <ContextMenu x={x} y={y} items={menuItems} onClose={onClose} />
      )}

      {activeModal === "quickInfo" && (
        <QuickLoanInfoCard
          loanId={loan.id}
          x={x}
          y={y}
          onClose={() => { setActiveModal(null); onClose(); }}
        />
      )}

      {activeModal === "moveTenant" && (
        <MoveTenantModal
          loan={loan}
          onClose={() => { setActiveModal(null); onClose(); }}
          onSuccess={() => { setActiveModal(null); onClose(); onLoanMutated?.(); }}
        />
      )}

      {activeModal === "delete" && (
        <DeleteLoanModal
          loan={loan}
          onClose={() => { setActiveModal(null); onClose(); }}
          onSuccess={() => { setActiveModal(null); onClose(); onLoanMutated?.(); }}
        />
      )}
    </>
  );
}
