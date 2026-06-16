import { useState } from "react";
import type { Template, TaskTemplate, ConditionTemplate } from "@/data/templates";
import { TASK_TEMPLATES, CONDITION_TEMPLATES } from "@/data/templates";

type Props = {
  type: "task" | "condition";
  onApply: (items: TaskTemplate[] | ConditionTemplate[]) => Promise<void>;
  onCancel: () => void;
};

export function TemplatePickerModal({ type, onApply, onCancel }: Props) {
  const templates = type === "task"
    ? (TASK_TEMPLATES as Template<TaskTemplate | ConditionTemplate>[])
    : (CONDITION_TEMPLATES as Template<TaskTemplate | ConditionTemplate>[]);

  const [selected, setSelected] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosenTemplate = templates.find((t) => t.id === selected);

  async function handleApply() {
    if (!chosenTemplate) return;
    setApplying(true);
    setError(null);
    try {
      await onApply(chosenTemplate.items as TaskTemplate[] & ConditionTemplate[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply template");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="tpl-overlay" onClick={onCancel}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-modal-header">
          <h3 className="tpl-modal-title">
            Apply {type === "task" ? "Task" : "Condition"} Template
          </h3>
          <button type="button" className="tpl-close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="tpl-modal-body">
          {/* Template list */}
          <div className="tpl-list">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tpl-card${selected === t.id ? " tpl-card--selected" : ""}`}
                onClick={() => setSelected(t.id)}
              >
                <div className="tpl-card-name">{t.name}</div>
                <div className="tpl-card-desc">{t.description}</div>
                <div className="tpl-card-count">{t.items.length} {type === "task" ? "tasks" : "conditions"}</div>
              </button>
            ))}
          </div>

          {/* Preview panel */}
          <div className="tpl-preview">
            {!chosenTemplate ? (
              <div className="tpl-preview-empty">Select a template to preview its items</div>
            ) : (
              <>
                <div className="tpl-preview-title">{chosenTemplate.name}</div>
                <ol className="tpl-preview-list">
                  {chosenTemplate.items.map((item, i) => (
                    <li key={i} className="tpl-preview-item">
                      {type === "task" ? (
                        <>
                          <span className={`tpl-priority tpl-priority--${(item as TaskTemplate).priority}`}>
                            {(item as TaskTemplate).priority}
                          </span>
                          <span className="tpl-preview-item-title">{(item as TaskTemplate).title}</span>
                        </>
                      ) : (
                        <>
                          <span className={`tpl-stage tpl-stage--${(item as ConditionTemplate).stage}`}>
                            {(item as ConditionTemplate).stage === "prior_to_docs" ? "PTD"
                              : (item as ConditionTemplate).stage === "prior_to_approval" ? "PTA"
                              : "PTF"}
                          </span>
                          <span className="tpl-preview-item-title">{(item as ConditionTemplate).name}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>

        {error && <div className="tpl-error">{error}</div>}

        <div className="tpl-modal-footer">
          <button type="button" className="tpl-btn tpl-btn--ghost" onClick={onCancel} disabled={applying}>
            Cancel
          </button>
          <button
            type="button"
            className="tpl-btn tpl-btn--primary"
            onClick={handleApply}
            disabled={!selected || applying}
          >
            {applying
              ? `Applying…`
              : chosenTemplate
                ? `Apply ${chosenTemplate.items.length} ${type === "task" ? "Tasks" : "Conditions"}`
                : "Apply Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
