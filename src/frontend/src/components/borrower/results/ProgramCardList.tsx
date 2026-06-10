import { ProgramCard } from "@/components/borrower/results/ProgramCard";
import type { ProgramRecommendation } from "@/types/intake";

type Props = {
  programs: ProgramRecommendation[];
};

export function ProgramCardList({ programs }: Props) {
  return (
    <div className="program-card-list">
      {programs.map((program) => (
        <ProgramCard key={program.program_key} program={program} />
      ))}
    </div>
  );
}
