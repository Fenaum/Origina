import { productGuidance, productLabels } from "@/data/submissionConfig";
import type { LoanProgram } from "@/types/submission";

export function ProductGuidanceCard({ product }: { product: LoanProgram | null }) {
  return (
    <aside className="submission-side-card fade-slide-in">
      <p className="eyebrow">What this product requires</p>
      {product ? (
        <>
          <h3>{productLabels[product]}</h3>
          <p>{productGuidance[product]}</p>
        </>
      ) : (
        <>
          <h3>Select a product</h3>
          <p>Requirements appear as soon as a Non-QM product is selected.</p>
        </>
      )}
    </aside>
  );
}
