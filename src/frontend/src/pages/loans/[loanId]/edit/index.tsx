import { useRouter } from "next/router";
import { useEffect } from "react";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";

export default function EditLoanRedirectPage() {
  const router = useRouter();
  const loanId = String(router.query.loanId ?? "");

  useEffect(() => {
    if (loanId) {
      void router.replace(`/loans/${loanId}/edit/setup`);
    }
  }, [loanId, router]);

  return (
    <ProtectedRoute allowedRoles={["account_executive", "broker"]}>
      <div className="centered-screen">Opening draft...</div>
    </ProtectedRoute>
  );
}
