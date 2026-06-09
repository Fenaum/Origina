type CurrencyInputProps = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  placeholder?: string;
};

export function CurrencyInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder = "$0",
}: CurrencyInputProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        onBlur={onBlur}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d.]/g, "");
          onChange(next ? Number(next) : null);
        }}
      />
    </label>
  );
}
