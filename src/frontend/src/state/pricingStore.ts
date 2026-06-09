import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { runMockPricing } from "@/services/pricingService";
import type { PricingInputParams, PricingScenario } from "@/types/submission";

type PricingStore = {
  scenarios: PricingScenario[];
  activeScenarioId: string | null;
  inputParams: PricingInputParams | null;
  isLoading: boolean;
  lastRunAt: string | null;
  runPricing: (params: PricingInputParams) => Promise<void>;
  selectScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
  duplicateScenario: (id: string) => void;
};

export const usePricingStore = create<PricingStore>()(
  devtools(
    (set, get) => ({
      scenarios: [],
      activeScenarioId: null,
      inputParams: null,
      isLoading: false,
      lastRunAt: null,
      runPricing: async (params) => {
        set({ isLoading: true, inputParams: params });
        const scenarios = await runMockPricing(params);
        const selected = scenarios.find((scenario) => scenario.isSelected) ?? scenarios[0];
        set({
          scenarios,
          activeScenarioId: selected?.id ?? null,
          isLoading: false,
          lastRunAt: new Date().toISOString(),
        });
      },
      selectScenario: (id) =>
        set({
          activeScenarioId: id,
          scenarios: get().scenarios.map((scenario) => ({
            ...scenario,
            isSelected: scenario.id === id,
          })),
        }),
      deleteScenario: (id) =>
        set({
          scenarios: get().scenarios.filter((scenario) => scenario.id !== id),
          activeScenarioId:
            get().activeScenarioId === id ? null : get().activeScenarioId,
        }),
      duplicateScenario: (id) => {
        const scenario = get().scenarios.find((item) => item.id === id);
        if (!scenario) return;
        set({
          scenarios: [
            ...get().scenarios,
            {
              ...scenario,
              id: `${scenario.id}-copy-${Date.now()}`,
              label: `${scenario.label} Copy`,
              isSelected: false,
              createdAt: new Date().toISOString(),
            },
          ],
        });
      },
    }),
    { name: "origina-pricing" },
  ),
);
