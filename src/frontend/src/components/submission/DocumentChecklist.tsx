import { useEffect } from "react";
import { useDocumentStore } from "@/state/documentStore";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import { DocumentChecklistItem } from "@/components/submission/documents/DocumentChecklistItem";

export function DocumentChecklist() {
  const product = useLoanSubmissionStore((state) => state.draft.setup.product);
  const borrowers = useLoanSubmissionStore((state) => state.draft.borrowers);
  const loanId = useLoanSubmissionStore((state) => state.draft.loanId);
  const checklist = useDocumentStore((state) => state.checklist);
  const generateChecklist = useDocumentStore((state) => state.generateChecklist);
  const loadDocumentsForLoan = useDocumentStore((state) => state.loadDocumentsForLoan);

  // Regenerate checklist when product changes, preserving any already-uploaded items.
  useEffect(() => {
    generateChecklist(product, borrowers, loanId);
  }, [borrowers, generateChecklist, loanId, product]);

  // On mount, reload document status from the DB so uploads survive page reloads.
  useEffect(() => {
    if (loanId && !loanId.startsWith("draft-")) {
      void loadDocumentsForLoan(loanId);
    }
  }, [loanId, loadDocumentsForLoan]);

  return (
    <section className="document-list fade-slide-in">
      {checklist.map((item) => (
        <DocumentChecklistItem item={item} key={item.docType} />
      ))}
    </section>
  );
}
