type FavoriteStarButtonProps = {
  isFavorited: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
};

export default function FavoriteStarButton({
  isFavorited,
  isLoading = false,
  disabled = false,
  title,
  onClick,
}: FavoriteStarButtonProps) {
  const label = title ?? (isFavorited ? "取消收藏" : "收藏");

  return (
    <button
      type="button"
      className={[
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition md:h-10 md:w-10",
        "hover:-translate-y-0.5 hover:bg-[var(--color-panel-soft-bg)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-soft)]",
        isFavorited
          ? "text-amber-400 hover:text-amber-500"
          : "text-soft hover:text-amber-400",
        disabled || isLoading ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
      aria-label={label}
      aria-pressed={isFavorited}
      title={label}
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6 md:h-7 md:w-7"
        fill={isFavorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 2.75 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.94l-5.56 2.93 1.06-6.2L3 9.28l6.22-.9L12 2.75Z" />
      </svg>
    </button>
  );
}
