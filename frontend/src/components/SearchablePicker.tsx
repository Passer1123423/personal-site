import { useEffect, useMemo, useRef, useState } from "react";

export type SearchablePickerOption = {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  searchText?: string;
};

type SearchablePickerProps = {
  value: string;
  options: SearchablePickerOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loadingText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export default function SearchablePicker({
  value,
  options,
  placeholder = "请选择",
  searchPlaceholder = "搜索...",
  emptyText = "没有匹配项",
  loadingText = "正在加载...",
  isLoading = false,
  disabled = false,
  onChange,
}: SearchablePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  const selectedOption = useMemo(() => {
    return options.find((option) => option.value === value) ?? null;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const cleanKeyword = keyword.trim().toLowerCase();

    if (!cleanKeyword) {
      return options;
    }

    return options.filter((option) => {
      const text = [
        option.label,
        option.description,
        option.badge,
        option.searchText,
        option.value,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(cleanKeyword);
    });
  }, [keyword, options]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) {
        return;
      }

      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setKeyword("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setKeyword("");
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setKeyword("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        className={[
          "flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border-control)] bg-white px-3 py-2 text-left text-sm outline-none transition",
          "hover:border-[var(--color-accent-border-strong)] focus:border-[var(--color-accent-border-strong)]",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
        onClick={() => {
          if (!disabled) {
            setOpen((value) => !value);
          }
        }}
      >
        <span className="min-w-0 flex-1">
          {selectedOption ? (
            <span className="flex min-w-0 items-center text-main">
              <span className="min-w-0 shrink truncate">
                {selectedOption.label}
              </span>
              {selectedOption.description && (
                <>
                  <span className="shrink-0 px-1 text-soft">：</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-soft">
                    {selectedOption.description}
                  </span>
                </>
              )}
            </span>
          ):(
            <span className="text-soft">{placeholder}</span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              className="rounded px-1.5 text-xs text-soft hover:bg-[var(--color-panel-soft-bg)] hover:text-main"
              onClick={(event) => {
                event.stopPropagation();
                onChange("");
                setKeyword("");
              }}
            >
              清空
            </span>
          )}

          <span className="text-xs text-soft">{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white shadow-lg">
          <div className="border-b border-[var(--color-border-soft)] bg-white px-3 py-2">
            <input
              ref={searchInputRef}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="w-full rounded-lg bg-[var(--color-panel-soft-bg)] px-3 py-2 text-sm text-main outline-none placeholder:text-soft focus:bg-white focus:ring-1 focus:ring-[var(--color-accent-border-strong)]"
              placeholder={searchPlaceholder}
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {isLoading ? (
              <div className="px-3 py-3 text-sm text-soft">{loadingText}</div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-soft">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => {
                const selected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={[
                      "block w-full px-3 py-2 text-left transition",
                      selected
                        ? "bg-[var(--color-accent-soft)]"
                        : "hover:bg-[var(--color-panel-soft-bg)]",
                    ].join(" ")}
                    onClick={() => handleSelect(option.value)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span
                          className={[
                            "block truncate text-sm",
                            selected
                              ? "font-medium text-[var(--color-accent)]"
                              : "text-main",
                          ].join(" ")}
                        >
                          {option.label}
                        </span>

                        {option.description && (
                          <span className="mt-0.5 block truncate text-xs text-soft">
                            {option.description}
                          </span>
                        )}
                      </span>

                      {option.badge && (
                        <span className="shrink-0 rounded bg-[var(--color-panel-soft-bg)] px-2 py-0.5 text-[11px] text-soft">
                          {option.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
