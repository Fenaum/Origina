import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LoanProgram, LoanStatus } from "@/types/loan";

export type ColumnId =
  | "loanNumber"
  | "borrowerName"
  | "status"
  | "loanProgram"
  | "loanAmount"
  | "channel"
  | "propertyState"
  | "owner"
  | "conditionsOpen"
  | "actionsNeeded"
  | "submittedAt"
  | "updatedAt"
  | "daysActive";

export type SortField =
  | "loanNumber"
  | "borrowerName"
  | "loanAmount"
  | "conditionsOpen"
  | "actionsNeeded"
  | "submittedAt"
  | "updatedAt"
  | "daysActive";

export type SortDir = "asc" | "desc";

export type PipelineFilters = {
  search: string;
  statuses: LoanStatus[];
  programs: LoanProgram[];
  minAmount: string;
  maxAmount: string;
  actionNeeded: boolean;
  conditionsOutstanding: boolean;
};

export const EMPTY_FILTERS: PipelineFilters = {
  search: "",
  statuses: [],
  programs: [],
  minAmount: "",
  maxAmount: "",
  actionNeeded: false,
  conditionsOutstanding: false,
};

export type SavedView = {
  id: string;
  label: string;
  builtIn: boolean;
  filters: PipelineFilters;
  sortField: SortField;
  sortDir: SortDir;
  columns: ColumnId[];
};

export const DEFAULT_COLUMNS: ColumnId[] = [
  "loanNumber",
  "borrowerName",
  "status",
  "loanProgram",
  "loanAmount",
  "conditionsOpen",
  "actionsNeeded",
  "owner",
  "submittedAt",
  "updatedAt",
];

export const ALL_COLUMN_DEFS: {
  id: ColumnId;
  label: string;
  sortKey?: SortField;
}[] = [
  { id: "loanNumber",     label: "Loan Number",  sortKey: "loanNumber"    },
  { id: "borrowerName",   label: "Borrower",     sortKey: "borrowerName"  },
  { id: "status",         label: "Status"                                 },
  { id: "loanProgram",    label: "Product"                                },
  { id: "loanAmount",     label: "Amount",       sortKey: "loanAmount"    },
  { id: "channel",        label: "Channel"                                },
  { id: "propertyState",  label: "State"                                  },
  { id: "owner",          label: "File Owner"                             },
  { id: "conditionsOpen", label: "Conditions",   sortKey: "conditionsOpen" },
  { id: "actionsNeeded",  label: "Actions",      sortKey: "actionsNeeded"  },
  { id: "submittedAt",    label: "Submitted",    sortKey: "submittedAt"    },
  { id: "updatedAt",      label: "Last Updated", sortKey: "updatedAt"      },
  { id: "daysActive",     label: "Days Active",  sortKey: "daysActive"     },
];

export const BUILT_IN_VIEWS: SavedView[] = [
  {
    id: "all-active",
    label: "All Active",
    builtIn: true,
    filters: EMPTY_FILTERS,
    sortField: "updatedAt",
    sortDir: "desc",
    columns: DEFAULT_COLUMNS,
  },
  {
    id: "conditions",
    label: "Conditions Review",
    builtIn: true,
    filters: { ...EMPTY_FILTERS, statuses: ["conditions_review"] as LoanStatus[] },
    sortField: "conditionsOpen",
    sortDir: "desc",
    columns: DEFAULT_COLUMNS,
  },
  {
    id: "action",
    label: "Action Needed",
    builtIn: true,
    filters: { ...EMPTY_FILTERS, actionNeeded: true },
    sortField: "actionsNeeded",
    sortDir: "desc",
    columns: DEFAULT_COLUMNS,
  },
  {
    id: "approved",
    label: "Approved",
    builtIn: true,
    filters: {
      ...EMPTY_FILTERS,
      statuses: ["approved", "approved_pending"] as LoanStatus[],
    },
    sortField: "updatedAt",
    sortDir: "desc",
    columns: DEFAULT_COLUMNS,
  },
  {
    id: "high-volume",
    label: "High Volume",
    builtIn: true,
    filters: EMPTY_FILTERS,
    sortField: "loanAmount",
    sortDir: "desc",
    columns: DEFAULT_COLUMNS,
  },
];

type StoreState = {
  sortField: SortField;
  sortDir: SortDir;
  filters: PipelineFilters;
  columns: ColumnId[];
  userViews: SavedView[];
  activeViewId: string | null;
  filterPanelOpen: boolean;
  columnManagerOpen: boolean;
};

type StoreActions = {
  toggleSort: (field: SortField) => void;
  setFilters: (patch: Partial<PipelineFilters>) => void;
  applyFilterPreset: (patch: Partial<PipelineFilters>, sortField?: SortField, sortDir?: SortDir) => void;
  resetFilters: () => void;
  applyView: (view: SavedView) => void;
  saveView: (label: string) => void;
  deleteView: (id: string) => void;
  setColumns: (cols: ColumnId[]) => void;
  setFilterPanelOpen: (open: boolean) => void;
  setColumnManagerOpen: (open: boolean) => void;
};

export const usePipelineStore = create<StoreState & StoreActions>()(
  persist(
    (set, get) => ({
      sortField: "updatedAt",
      sortDir: "desc",
      filters: EMPTY_FILTERS,
      columns: DEFAULT_COLUMNS,
      userViews: [],
      activeViewId: "all-active",
      filterPanelOpen: false,
      columnManagerOpen: false,

      toggleSort: (field) =>
        set((s) => ({
          sortField: field,
          sortDir: s.sortField === field && s.sortDir === "asc" ? "desc" : "asc",
          activeViewId: null,
        })),

      setFilters: (patch) =>
        set((s) => ({
          filters: { ...s.filters, ...patch },
          activeViewId: null,
        })),

      applyFilterPreset: (patch, sortField, sortDir) =>
        set((s) => ({
          filters: { ...EMPTY_FILTERS, ...patch },
          sortField: sortField ?? s.sortField,
          sortDir: sortDir ?? s.sortDir,
          activeViewId: null,
        })),

      resetFilters: () =>
        set({
          filters: EMPTY_FILTERS,
          sortField: "updatedAt",
          sortDir: "desc",
          activeViewId: "all-active",
        }),

      applyView: (view) =>
        set({
          filters: view.filters,
          sortField: view.sortField,
          sortDir: view.sortDir,
          columns: view.columns,
          activeViewId: view.id,
        }),

      saveView: (label) => {
        const { filters, sortField, sortDir, columns } = get();
        const newView: SavedView = {
          id: `view-${Date.now()}`,
          label: label.trim(),
          builtIn: false,
          filters,
          sortField,
          sortDir,
          columns,
        };
        set((s) => ({
          userViews: [...s.userViews, newView],
          activeViewId: newView.id,
        }));
      },

      deleteView: (id) =>
        set((s) => ({
          userViews: s.userViews.filter((v) => v.id !== id),
          activeViewId: s.activeViewId === id ? "all-active" : s.activeViewId,
        })),

      setColumns: (cols) => set({ columns: cols, activeViewId: null }),

      setFilterPanelOpen: (open) =>
        set({ filterPanelOpen: open, columnManagerOpen: false }),

      setColumnManagerOpen: (open) =>
        set({ columnManagerOpen: open, filterPanelOpen: false }),
    }),
    {
      name: "origina.pipeline.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        sortField: s.sortField,
        sortDir: s.sortDir,
        columns: s.columns,
        userViews: s.userViews,
      }),
    },
  ),
);

export function getAllViews(userViews: SavedView[]): {
  builtIn: SavedView[];
  user: SavedView[];
} {
  return { builtIn: BUILT_IN_VIEWS, user: userViews };
}

export function hasActiveFilters(f: PipelineFilters): boolean {
  return (
    f.search.trim() !== "" ||
    f.statuses.length > 0 ||
    f.programs.length > 0 ||
    f.minAmount !== "" ||
    f.maxAmount !== "" ||
    f.actionNeeded ||
    f.conditionsOutstanding
  );
}
