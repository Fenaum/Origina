import { useRouter } from "next/router";
import { useEffect } from "react";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useLoanSubmissionStore } from "@/state/submissionStore";

export default function ManualApplicationRedirectPage() {
  const router = useRouter();
  const startNewDraft = useLoanSubmissionStore((state) => state.startNewDraft);

  useEffect(() => {
    startNewDraft("manual").then((loanId) => {
      void router.replace(`/loans/${loanId}/edit/setup`);
    });
  }, [router, startNewDraft]);

  return (
    <ProtectedRoute allowedRoles={["account_executive", "broker"]}>
      <div className="centered-screen">Starting application...</div>
    </ProtectedRoute>
  );
}
