// SavedViewsDropdown — Phase 4.
//
// Dropdown in the analytics header that lets users save the current filter
// state, recall a previously-saved view, or delete their own views. Shared
// views are visible to all users in the tenant but only the owner can edit
// or delete them.
//
// Visuals: brand-filled trigger with a gradient pill when a view is active,
// gradient popover header with a star icon, animated list rows, save form with
// primary CTA, and a confirmation tooltip for the delete button.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
} from "@/services/analyticsService";
import { useAuth } from "@/state/auth";
import {
  ChevronDownIcon,
  CloseIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
} from "@/components/analytics/ChartIcons";
import type { AnalyticsFilter, SavedView } from "@/types/analytics";

type SavedViewsDropdownProps = {
  currentFilter: AnalyticsFilter;
  currentViewId: string | null;
  onLoad: (view: SavedView) => void;
  onClearActiveView: () => void;
  rolePreset?: string | null;
};

export function SavedViewsDropdown({
  currentFilter,
  currentViewId,
  onLoad,
  onClearActiveView,
  rolePreset = null,
}: SavedViewsDropdownProps) {
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsShared, setNewIsShared] = useState(false);

  const { data: views = [], isLoading } = useQuery({
    queryKey: ["analytics", "saved-views"],
    queryFn: () => listSavedViews(token ?? undefined),
    enabled: Boolean(token),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createSavedView(
        {
          name: newName.trim(),
          description: newDescription.trim() || null,
          filter_state: currentFilter,
          role_preset: rolePreset,
          is_shared: newIsShared,
        },
        token ?? undefined,
      ),
    onSuccess: (view) => {
      qc.invalidateQueries({ queryKey: ["analytics", "saved-views"] });
      onLoad(view);
      setShowSaveDialog(false);
      setNewName("");
      setNewDescription("");
      setNewIsShared(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (viewId: string) => deleteSavedView(viewId, token ?? undefined),
    onSuccess: (_data, viewId) => {
      qc.invalidateQueries({ queryKey: ["analytics", "saved-views"] });
      if (viewId === currentViewId) onClearActiveView();
    },
  });

  const activeView = views.find((v) => v.id === currentViewId) ?? null;
  const canShare = user?.role === "admin" || user?.role === "manager" || user?.role === "account_manager";

  return (
    <div className="saved-views">
      <button
        type="button"
        className={`saved-views-trigger ${activeView ? "saved-views-trigger--active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {activeView ? (
          <>
            <StarIcon width={13} height={13} />
            <span className="saved-views-trigger-name">{activeView.name}</span>
          </>
        ) : (
          <>
            <SparklesIcon width={13} height={13} />
            <span>Saved views</span>
          </>
        )}
        <span className="saved-views-trigger-chevron" aria-hidden>
          <ChevronDownIcon width={11} height={11} />
        </span>
      </button>

      {open ? (
        <div className="saved-views-popover panel fade-slide-in">
          <header className="saved-views-popover-header">
            <div>
              <span className="saved-views-eyebrow">Saved views</span>
              <h4>Your analytics snapshots</h4>
            </div>
            <button
              type="button"
              className="saved-views-save-trigger"
              onClick={() => setShowSaveDialog(true)}
            >
              <SparklesIcon width={12} height={12} />
              Save current
            </button>
          </header>

          {isLoading ? (
            <p className="saved-views-empty">Loading…</p>
          ) : views.length === 0 ? (
            <p className="saved-views-empty">
              No saved views yet. Save your current filter to reuse it later.
            </p>
          ) : (
            <ul className="saved-views-list">
              {views.map((v) => {
                const ownedByMe = v.created_by === user?.id;
                const isActive = v.id === currentViewId;
                return (
                  <li
                    key={v.id}
                    className={isActive ? "saved-views-item-row saved-views-item-row--active" : "saved-views-item-row"}
                  >
                    <button
                      type="button"
                      className="saved-views-item"
                      onClick={() => {
                        onLoad(v);
                        setOpen(false);
                      }}
                    >
                      <span className="saved-views-item-icon" aria-hidden>
                        {v.is_shared ? <UsersIcon width={12} height={12} /> : <StarIcon width={12} height={12} />}
                      </span>
                      <span className="saved-views-item-text">
                        <span className="saved-views-name">{v.name}</span>
                        {v.description ? (
                          <span className="saved-views-desc">{v.description}</span>
                        ) : null}
                      </span>
                      {isActive ? (
                        <span className="saved-views-active-dot" aria-hidden />
                      ) : null}
                    </button>
                    {ownedByMe ? (
                      <button
                        type="button"
                        className="saved-views-delete"
                        onClick={() => {
                          if (confirm(`Delete saved view "${v.name}"?`)) {
                            deleteMut.mutate(v.id);
                          }
                        }}
                        aria-label={`Delete ${v.name}`}
                        title="Delete this view"
                      >
                        <CloseIcon width={11} height={11} />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {showSaveDialog ? (
            <div className="saved-views-dialog">
              <input
                type="text"
                placeholder="View name (e.g. Q1 Submissions)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={80}
              />
              <textarea
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                maxLength={500}
                rows={2}
              />
              {canShare ? (
                <label className="saved-views-share">
                  <input
                    type="checkbox"
                    checked={newIsShared}
                    onChange={(e) => setNewIsShared(e.target.checked)}
                  />
                  Share with everyone in this tenant
                </label>
              ) : null}
              <div className="saved-views-dialog-actions">
                <button
                  type="button"
                  className="saved-views-cancel"
                  onClick={() => setShowSaveDialog(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="saved-views-confirm"
                  disabled={newName.trim().length === 0 || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  <SparklesIcon width={12} height={12} />
                  {createMut.isPending ? "Saving…" : "Save view"}
                </button>
              </div>
              {createMut.isError ? (
                <p className="saved-views-error">
                  Couldn&apos;t save view. Make sure the current filters are valid.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}