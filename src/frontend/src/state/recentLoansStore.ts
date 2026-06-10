import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type RecentLoan = {
  id: string;
  borrowerName: string;
  loanNumber: string;
};

type RecentLoansStore = {
  recent: RecentLoan[];
  push: (loan: RecentLoan) => void;
};

export const useRecentLoansStore = create<RecentLoansStore>()(
  persist(
    (set) => ({
      recent: [],
      push: (loan) =>
        set((state) => ({
          recent: [loan, ...state.recent.filter((r) => r.id !== loan.id)].slice(0, 5),
        })),
    }),
    {
      name: "origina.recent-loans",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
