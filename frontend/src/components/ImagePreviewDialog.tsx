import { useEffect } from "react";

export type ImagePreviewItem = {
  src: string;
  alt?: string;
  title?: string;
};

type ImagePreviewDialogProps = {
  images: ImagePreviewItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export default function ImagePreviewDialog({
  images,
  currentIndex,
  onIndexChange,
  onClose,
}: ImagePreviewDialogProps) {
  const hasMultipleImages = images.length > 1;
  const normalizedIndex =
    images.length === 0
      ? 0
      : Math.min(Math.max(currentIndex, 0), images.length - 1);
  const currentImage = images[normalizedIndex];

  useEffect(() => {
    const { overflow } = document.body.style;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (!hasMultipleImages) {
        return;
      }

      if (event.key === "ArrowLeft") {
        onIndexChange((normalizedIndex - 1 + images.length) % images.length);
      }

      if (event.key === "ArrowRight") {
        onIndexChange((normalizedIndex + 1) % images.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasMultipleImages, images.length, normalizedIndex, onClose, onIndexChange]);

  if (!currentImage) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded border border-white/20 bg-black/30 text-xl leading-none text-white/80 hover:bg-black/50 hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="关闭图片预览"
      >
        <span className="-translate-y-px leading-none">×</span>
      </button>

      {hasMultipleImages && (
        <>
          <button
            type="button"
            className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/80 transition hover:border-[var(--color-accent-border-strong)] hover:bg-black/50 hover:text-[var(--color-accent)] sm:left-4 sm:h-10 sm:w-10"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((normalizedIndex - 1 + images.length) % images.length);
            }}
            aria-label="上一张图片"
          >
            <span className="-translate-y-px text-2xl leading-none">‹</span>
          </button>

          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/80 transition hover:border-[var(--color-accent-border-strong)] hover:bg-black/50 hover:text-[var(--color-accent)] sm:right-4 sm:h-10 sm:w-10"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((normalizedIndex + 1) % images.length);
            }}
            aria-label="下一张图片"
          >
            <span className="-translate-y-px text-2xl leading-none">›</span>
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-xs text-white/80">
            {normalizedIndex + 1}/{images.length}
          </div>
        </>
      )}

      <img
        src={currentImage.src}
        alt={currentImage.alt ?? currentImage.title ?? "图片预览"}
        className="max-h-full max-w-full cursor-default rounded-xl object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
