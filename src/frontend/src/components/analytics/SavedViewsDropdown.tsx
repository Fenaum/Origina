// SavedViewsDropdown — Phase 4.
//
// Dropdown in the analytics header that lets users save the current filter
// state, recall a previously-saved view, or delete their own views. Shared
// views are visible to all users in the tenant but only the owner can edit
// or delete them.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
} from "@/services/analyticsService";
import { useAuth } from "@/state/auth";
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
        className="ghost-button saved-views-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {activeView ? `★ ${activeView.name}` : "☆ Saved views"}
        <span aria-hidden>▾</span>
      </button>

      {open ? (
        <div className="saved-views-popover panel fade-slide-in">
          <header>
            <h4>Saved views</h4>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setShowSaveDialog(true)}
            >
              + Save current
            </button>
          </header>

          {isLoading ? (
            <p className="saved-views-empty">Loading…</p>
          ) : views.length === 0 ? (
            <p className="saved-views-empty">No saved views yet. Save your current filter to reuse it later.</p>
          ) : (
            <ul className="saved-views-list">
              {views.map((v) => {
                const ownedByMe = v.created_by === user?.id;
                return (
                  <li key={v.id} className={v.id === currentViewId ? "active" : undefined}>
                    <button
                      type="button"
                      className="saved-views-item"
                      onClick={() => {
                        onLoad(v);
                        setOpen(false);
                      }}
                    >
                      <span className="saved-views-name">
                        {v.is_shared ? <span title="Shared with tenant">👥 </span> : null}
                        {v.name}
                      </span>
                      {v.description ? <span className="saved-views-desc">{v.description}</span> : null}
                    </button>
                    {ownedByMe ? (
                      <button
                        type="button"
                        className="ghost-button saved-views-delete"
                        onClick={() => {
                          if (confirm(`Delete saved view "${v.name}"?`)) {
                            deleteMut.mutate(v.id);
                          }
                        }}
                        aria-label={`Delete ${v.name}`}
                        title="Delete this view"
                      >
                        ✕
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
                placeholder="View name"
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
                  className="ghost-button"
                  onClick={() => setShowSaveDialog(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={newName.trim().length === 0 || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending ? "Saving…" : "Save view"}
                </button>
              </div>
              {createMut.isError ? (
                <p className="saved-views-error">
                  Couldn't save view. Make sure the current filters are valid.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}