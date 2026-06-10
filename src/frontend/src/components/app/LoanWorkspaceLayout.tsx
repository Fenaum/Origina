import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Sidebar } from "@/components/app/Sidebar";
import type { UserRole } from "@/types/auth";

type Props = {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
};

export function LoanWorkspaceLayout({ allowedRoles, children }: Props) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <div className="app-shell">
        <Sidebar />
        <main className="loan-workspace-main">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
