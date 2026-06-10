import { create } from "zustand";

export type NotificationType =
  | "condition"
  | "assignment"
  | "document"
  | "status"
  | "mention"
  | "ctc";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  loanNumber?: string;
  createdAt: string;
  read: boolean;
};

type NotificationsStore = {
  notifications: AppNotification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const MOCK: AppNotification[] = [
  {
    id: "n1",
    type: "condition",
    title: "New condition added",
    body: "Bank statements (12 months) added to loan file.",
    loanNumber: "ORG-2024-00042",
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    read: false,
  },
  {
    id: "n2",
    type: "assignment",
    title: "Loan assigned to you",
    body: "Williams, Sarah has been assigned to your pipeline.",
    loanNumber: "ORG-2024-00091",
    createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    read: false,
  },
  {
    id: "n3",
    type: "status",
    title: "Status changed",
    body: "Johnson, Robert moved to Approved Pending.",
    loanNumber: "ORG-2024-00031",
    createdAt: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
    read: false,
  },
  {
    id: "n4",
    type: "document",
    title: "Document uploaded",
    body: "Tax returns uploaded by broker.",
    loanNumber: "ORG-2024-00087",
    createdAt: new Date(Date.now() - 6 * 60 * 60_000).toISOString(),
    read: true,
  },
  {
    id: "n5",
    type: "mention",
    title: "You were mentioned",
    body: "You were mentioned in a note on Lee, Jennifer.",
    loanNumber: "ORG-2024-00156",
    createdAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
    read: true,
  },
  {
    id: "n6",
    type: "ctc",
    title: "Clear to Close",
    body: "Thompson, David is Clear to Close.",
    loanNumber: "ORG-2024-00019",
    createdAt: new Date(Date.now() - 28 * 60 * 60_000).toISOString(),
    read: true,
  },
];

export const useNotificationsStore = create<NotificationsStore>()((set) => ({
  notifications: MOCK,
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
  clearAll: () => set({ notifications: [] }),
}));
