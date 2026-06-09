import { useEffect } from "react";
import { useDocumentStore } from "@/state/documentStore";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import { DocumentChecklistItem } from "@/components/submission/documents/DocumentChecklistItem";

export function DocumentChecklist() {
  const product = useLoanSubmissionStore((state) => state.draft.setup.product);
  const borrowers = useLoanSubmissionStore((state) => state.draft.borrowers);
  const checklist = useDocumentStore((state) => state.checklist);
  const generateChecklist = useDocumentStore((state) => state.generateChecklist);

  useEffect(() => {
    generateChecklist(product, borrowers);
  }, [borrowers, generateChecklist, product]);

  return (
    <section className="document-list fade-slide-in">
      {checklist.map((item) => (
        <DocumentChecklistItem item={item} key={item.docType} />
      ))}
    </section>
  );
}
