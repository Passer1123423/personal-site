import type { InputHTMLAttributes, ReactNode } from "react";

type SearchBoxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
};

export default function SearchBox({
  value,
  onChange,
  onClear,
  leftAddon,
  rightAddon,
  placeholder = "搜索...",
  className = "",
  disabled = false,
  ...inputProps
}: SearchBoxProps) {
  const showClear = value.trim().length > 0;

  return (
    <div
      className={[
        "flex min-w-0 items-center gap-2 rounded-xl border border-[var(--color-border-control)] bg-white px-3 py-2 text-sm transition",
        "focus-within:border-[var(--color-accent-border-strong)] focus-within:ring-2 focus-within:ring-[var(--color-accent-soft)]",
        disabled ? "opacity-60" : "hover:border-[var(--color-accent-border-strong)]",
        className,
      ].join(" ")}
    >
      <span className="flex shrink-0 items-center text-soft">
        {leftAddon ?? (
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="10.75" cy="10.75" r="5.75" />
            <path d="m15.25 15.25 4 4" />
          </svg>
        )}
      </span>

      <input
        {...inputProps}
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-main outline-none placeholder:text-soft disabled:cursor-not-allowed"
        onChange={(event) => onChange(event.target.value)}
      />

      {rightAddon}

      {showClear && (
        <button
          type="button"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-soft transition hover:bg-[var(--color-panel-soft-bg)] hover:text-main"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
        >
          清空
        </button>
      )}
    </div>
  );
}
