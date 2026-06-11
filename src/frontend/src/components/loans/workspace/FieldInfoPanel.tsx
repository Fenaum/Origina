type Props = {
  meta: FieldMeta;
  onClose: () => void;
  onShowHistory: () => void;
};

export type FieldMeta = {
  label: string;
  apiKey: string;
  dbColumn: string;
  table: string;
  fieldType: string;
  required: boolean;
  validation?: string;
  description?: string;
};

export function FieldInfoPanel({ meta, onClose, onShowHistory }: Props) {
  return (
    <div className="field-panel-overlay" onClick={onClose}>
      <div className="field-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Field information">
        <div className="field-panel-header">
          <div>
            <h3 className="field-panel-title">{meta.label}</h3>
            <code className="field-panel-api-key">{meta.apiKey}</code>
          </div>
          <button type="button" className="field-panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="field-panel-body">
          <div className="field-info-grid">
            <InfoRow label="UI Label"       value={meta.label} />
            <InfoRow label="API Field"      value={meta.apiKey} code />
            <InfoRow label="DB Column"      value={meta.dbColumn} code />
            <InfoRow label="Table / Model"  value={meta.table} code />
            <InfoRow label="Type"           value={meta.fieldType} />
            <InfoRow label="Required"       value={meta.required ? "Yes" : "No"} />
            {meta.validation  && <InfoRow label="Validation" value={meta.validation} />}
            {meta.description && <InfoRow label="Description" value={meta.description} />}
          </div>

          <button
            type="button"
            className="field-panel-history-btn"
            onClick={onShowHistory}
          >
            📜 View Field History
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, code }: { label: string; value: string; code?: boolean }) {
  return (
    <div className="field-info-row">
      <span className="field-info-label">{label}</span>
      {code
        ? <code className="field-info-code">{value}</code>
        : <span className="field-info-value">{value}</span>}
    </div>
  );
}
