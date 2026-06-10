import { useEffect, useRef, useState } from "react";

type ToastState = { type: "success" | "error"; message: string } | null;

type Props = {
  title: string;
  subtitle?: string;
  isDirty: boolean;
  isSaving: boolean;
  saveError?: string | null;
  onSave: () => void;
  onCancel: () => void;
  /** Increment each time a save completes successfully to trigger the success toast */
  saveCount?: number;
};

export function WorkspaceSaveBar({
  title,
  subtitle,
  isDirty,
  isSaving,
  saveError,
  onSave,
  onCancel,
  saveCount,
}: Props) {
  const [toast, setToast] = useState<ToastState>(null);
  const prevSaveCount = useRef(saveCount ?? 0);
  const prevSaveError = useRef(saveError);

  // success toast — triggered when saveCount increments
  useEffect(() => {
    const current = saveCount ?? 0;
    if (current > prevSaveCount.current) {
      prevSaveCount.current = current;
      let cancelled = false;
      Promise.resolve().then(() => {
        if (!cancelled) setToast({ type: "success", message: "Changes saved" });
        setTimeout(() => { if (!cancelled) setToast(null); }, 3000);
      });
      return () => { cancelled = true; };
    }
  }, [saveCount]);

  // error toast — triggered when saveError changes to a non-null value
  useEffect(() => {
    if (saveError && saveError !== prevSaveError.current) {
      prevSaveError.current = saveError;
      let cancelled = false;
      Promise.resolve().then(() => {
        if (!cancelled) setToast({ type: "error", message: saveError });
        setTimeout(() => { if (!cancelled) setToast(null); }, 5000);
      });
      return () => { cancelled = true; };
    }
    if (!saveError) prevSaveError.current = null;
  }, [saveError]);

  return (
    <div className="ws-save-bar">
      <div className="ws-save-bar-left">
        <h2 className="ws-save-bar-title">{title}</h2>
        {subtitle && <span className="ws-save-bar-subtitle">{subtitle}</span>}
      </div>
      <div className="ws-save-bar-right">
        {toast && (
          <span className={`ws-toast ws-toast--${toast.type}`} role="status">
            {toast.type === "success" ? "✓" : "⚠"} {toast.message}
          </span>
        )}
        <button
          type="button"
          className="ws-save-btn ws-save-btn--ghost"
          onClick={onCancel}
          disabled={!isDirty || isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="ws-save-btn ws-save-btn--primary"
          onClick={onSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
