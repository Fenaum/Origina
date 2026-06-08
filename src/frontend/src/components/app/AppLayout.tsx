import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { Sidebar } from "@/components/app/Sidebar";
import { TopHeader } from "@/components/app/TopHeader";
import type { UserRole } from "@/types/auth";

type AppLayoutProps = {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
};

export function AppLayout({ allowedRoles, children }: AppLayoutProps) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <div className="app-shell">
        <Sidebar />
        <main className="main-panel">
          <TopHeader />
          <div className="page-content">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
