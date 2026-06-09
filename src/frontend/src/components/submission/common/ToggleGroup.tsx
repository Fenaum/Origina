type ToggleOption<T extends string> = {
  label: string;
  value: T;
};

type ToggleGroupProps<T extends string> = {
  label: string;
  value: T | null;
  options: ToggleOption<T>[];
  onChange: (value: T) => void;
};

export function ToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: ToggleGroupProps<T>) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented-control">
        {options.map((option) => (
          <button
            className={value === option.value ? "active" : ""}
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
