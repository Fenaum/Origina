import { useReducer, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CheckIcon, RefreshIcon } from "./icons";

type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  onSave?: () => Promise<void>;
  isSaving?: boolean;
  footer?: React.ReactNode;
};

type DirtyState = "clean" | "dirty" | "saving" | "saved";

function reducer(state: DirtyState, action: "markDirty" | "markSaving" | "markSaved" | "reset"): DirtyState {
  switch (action) {
    case "markDirty": return "dirty";
    case "markSaving": return "saving";
    case "markSaved": return "saved";
    case "reset": return "clean";
  }
}

export function SectionCard({
  title,
  description,
  children,
  className,
  footer,
}: SectionCardProps) {
  return (
    <section className={cn("section-card", className)} aria-labelledby={`section-${title}`}>
      <div className="section-card-header">
        <h2 className="section-card-title" id={`section-${title}`}>{title}</h2>
        {description && <p className="section-card-description">{description}</p>}
      </div>
      <div className="section-card-body">{children}</div>
      {footer && <div className="section-card-footer">{footer}</div>}
    </section>
  );
}

/**
 * A dirty-tracking form wrapper around a SectionCard.
 * - Wires onSave to a useMutation so you don't have to.
 * - Shows local dirty/saving/saved state on the card level.
 * - Calls onSaved(data) with the response when done.
 */
type DirtyCardProps<T> = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  mutation: ReturnType<typeof useMutation<T, Error, unknown>>;
  onSaved?: (data: T) => void;
  footer?: React.ReactNode;
};

export function DirtySectionCard<T>({
  title,
  description,
  children,
  className,
  mutation,
  onSaved,
  footer,
}: DirtyCardProps<T>) {
  const [state, dispatch] = useReducer(reducer, "clean");

  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const handleSave = useCallback(async () => {
    dispatch("markSaving");
    try {
      const data = await mutation.mutateAsync(mutation.variables);
      dispatch("markSaved");
      onSavedRef.current?.(data);
      // Reset to clean after a brief visual confirmation
      setTimeout(() => dispatch("reset"), 2000);
    } catch {
      dispatch("markDirty");
    }
  }, [mutation]);

  return (
    <section
      className={cn("section-card", `is-${state}`, className)}
      aria-labelledby={`section-${title}`}
    >
      <div className="section-card-header">
        <div className="section-card-title-row">
          <h2 className="section-card-title" id={`section-${title}`}>{title}</h2>
          {state === "saving" && (
            <span className="section-card-status" aria-live="polite">
              <span className="save-dot is-saving" aria-hidden /> Saving…
            </span>
          )}
          {state === "saved" && (
            <span className="section-card-status is-saved" aria-live="polite">
              <span className="save-dot is-saved" aria-hidden /> Saved
            </span>
          )}
        </div>
        {description && <p className="section-card-description">{description}</p>}
      </div>
      <div className="section-card-body">{children}</div>
      {footer ?? (
        <div className="section-card-footer">
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={state === "saving" || mutation.isError}
          >
            {state === "saving" ? <RefreshIcon size={14} /> : <CheckIcon size={14} />}
            {state === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </section>
  );
}
