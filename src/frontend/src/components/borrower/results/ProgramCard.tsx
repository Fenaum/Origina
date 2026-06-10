import Link from "next/link";
import type { ProgramRecommendation } from "@/types/intake";

type Props = {
  program: ProgramRecommendation;
};

export function ProgramCard({ program }: Props) {
  const badge = program.match_strength === "strong"
    ? "Strong Match"
    : program.match_strength === "possible"
      ? "Possible Fit"
      : "May Not Fit";

  return (
    <article className={`program-card ${program.match_strength}`}>
      <div className="program-card-header">
        <span>{program.disqualified ? "Near Miss" : `Match ${program.rank}`}</span>
        <strong>{badge}</strong>
      </div>
      <h2>{program.title}</h2>
      <p>{program.tagline}</p>
      <div className="program-rate">
        <div className="program-rate-label">{program.rate_range_label}</div>
        <div className="program-rate-disclaimer">Illustrative only — not a rate quote or commitment to lend</div>
      </div>
      <div>
        <h3>Documents often needed</h3>
        <ul>
          {program.doc_requirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </div>
      <p className="program-note">{program.suitability_note}</p>
      <div className="program-actions">
        <Link href="/borrower/handoff" className="borrower-primary-btn compact">
          Talk to a Specialist
        </Link>
      </div>
    </article>
  );
}
