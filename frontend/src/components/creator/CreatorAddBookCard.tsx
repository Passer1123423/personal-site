// src/components/creator/CreatorAddBookCard.tsx

type CreatorAddBookCardProps = {
  label: string;
  description?: string;
  onClick: () => void;
};

export default function CreatorAddBookCard({
  label,
  description,
  onClick,
}: CreatorAddBookCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-24 text-left sm:w-32"
    >
      <div className="relative aspect-[5/7] border border-dashed border-[var(--color-border-control)] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.10)] transition duration-200 group-hover:-translate-y-1 group-hover:border-[var(--color-accent-border-strong)] group-hover:shadow-[0_16px_32px_rgba(15,23,42,0.16)] sm:shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
        <div className="absolute inset-y-0 left-0 w-2.5 border-r border-black/10 bg-black/5 sm:w-3" />

        <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel-soft-bg)]">
          <span className="text-3xl font-light text-soft transition group-hover:text-[var(--color-accent)] sm:text-4xl">
            +
          </span>
        </div>
      </div>

      <div className="mt-2 min-h-[64px] sm:mt-3 sm:min-h-[74px]">
        <h3 className="text-xs font-semibold leading-4 text-main group-hover:underline group-hover:underline-offset-4 sm:text-sm sm:leading-5">
          {label}
        </h3>

        <p className="mt-1 text-[11px] leading-4 text-soft sm:text-xs sm:leading-5">
          {description ?? "点击创建新的书架条目"}
        </p>
      </div>
    </button>
  );
}