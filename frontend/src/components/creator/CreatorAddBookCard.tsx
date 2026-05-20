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
      className="group block w-28 text-left sm:w-32"
    >
      <div className="relative aspect-[5/7] border border-dashed border-[var(--color-border-control)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.10)] transition duration-200 group-hover:-translate-y-1 group-hover:border-[var(--color-accent-border-strong)] group-hover:shadow-[0_16px_32px_rgba(15,23,42,0.16)]">
        <div className="absolute inset-y-0 left-0 w-3 border-r border-black/10 bg-black/5" />

        <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel-soft-bg)]">
          <span className="text-4xl font-light text-soft transition group-hover:text-[var(--color-accent)]">
            +
          </span>
        </div>
      </div>

      <div className="mt-3 min-h-[74px]">
        <h3 className="text-sm font-semibold leading-5 text-main group-hover:underline group-hover:underline-offset-4">
          {label}
        </h3>

        <p className="mt-1 text-xs leading-5 text-soft">
          {description ?? "点击创建新的书架条目"}
        </p>
      </div>
    </button>
  );
}