import { useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "../../api/config";
import {
  deleteAuthorNovelChapterImage,
  fetchAuthorNovelChapterImages,
  uploadAuthorNovelChapterImage,
  type AuthorNovelChapterImage,
} from "../../api/authorNovels";

type NovelChapterImagePanelProps = {
  novelSlug: string;
  chapterSlug: string;
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
  onInsertMarkdown?: (markdown: string) => void;
  onMessage?: (message: { type: "success" | "error"; text: string }) => void;
};

const MAX_IMAGE_COUNT = 20;

function resolveAssetUrl(url: string) {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_BASE_URL}${url}`;
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function NovelChapterImagePanel({
  novelSlug,
  chapterSlug,
  open,
  disabled = false,
  onClose,
  onInsertMarkdown,
  onMessage,
}: NovelChapterImagePanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [images, setImages] = useState<AuthorNovelChapterImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const reachedLimit = images.length >= MAX_IMAGE_COUNT;
  const canUpload = !disabled && !loading && !uploading && !reachedLimit;

  const imageCountText = useMemo(() => {
    return `${images.length}/${MAX_IMAGE_COUNT}`;
  }, [images.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    const mediaQuery = window.matchMedia("(max-width: 767px)");

    if (mediaQuery.matches) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || disabled) {
      return;
    }

    loadImages();
  }, [open, disabled, novelSlug, chapterSlug]);

  async function loadImages() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchAuthorNovelChapterImages({
        novelSlug,
        chapterSlug,
      });

      setImages(data);
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "加载章节图片失败";
      setErrorMessage(text);
      onMessage?.({ type: "error", text });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    if (!file.type.startsWith("image/")) {
      const text = "只能上传图片文件。";
      setErrorMessage(text);
      onMessage?.({ type: "error", text });
      return;
    }

    if (reachedLimit) {
      const text = `每个章节最多上传 ${MAX_IMAGE_COUNT} 张图片。`;
      setErrorMessage(text);
      onMessage?.({ type: "error", text });
      return;
    }

    setUploading(true);
    setErrorMessage("");

    try {
      const image = await uploadAuthorNovelChapterImage({
        novelSlug,
        chapterSlug,
        file,
      });

      setImages((previous) => [...previous, image]);
      onMessage?.({ type: "success", text: "图片已上传。" });
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "上传章节图片失败";
      setErrorMessage(text);
      onMessage?.({ type: "error", text });
    } finally {
      setUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleCopyMarkdown(image: AuthorNovelChapterImage) {
    try {
      await navigator.clipboard.writeText(image.markdown);
      onMessage?.({ type: "success", text: "Markdown 图片链接已复制。" });
    } catch {
      setErrorMessage("复制失败，请手动复制。");
      onMessage?.({ type: "error", text: "复制失败，请手动复制。" });
    }
  }

  function handleInsertMarkdown(image: AuthorNovelChapterImage) {
    onInsertMarkdown?.(image.markdown);
  }

  async function handleDelete(image: AuthorNovelChapterImage) {
    const confirmed = window.confirm(
      `确定删除这张图片吗？\n\n${image.originalName}`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(image.id);
    setErrorMessage("");

    try {
      const nextImages = await deleteAuthorNovelChapterImage({
        novelSlug,
        chapterSlug,
        imageId: image.id,
      });

      setImages(nextImages);
      onMessage?.({ type: "success", text: "图片已删除。" });
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "删除章节图片失败";
      setErrorMessage(text);
      onMessage?.({ type: "error", text });
    } finally {
      setDeletingId("");
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/20 p-3 sm:absolute sm:inset-auto sm:right-4 sm:top-14 sm:w-[360px] sm:bg-transparent sm:p-0">
      <div className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-panel-bg)] shadow-xl sm:max-h-[520px] sm:max-w-none">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-soft)] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-main">章节图片</p>
            <p className="mt-0.5 text-[11px] text-soft">
              {imageCountText} · 插入为 Markdown 图片
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border-soft)] text-sm text-soft hover:border-[var(--color-accent-border-strong)] hover:text-[var(--color-accent)]"
            onClick={onClose}
            aria-label="关闭图片面板"
          >
            <span className="-translate-y-px leading-none">×</span>
          </button>
        </div>

        <div className="border-b border-[var(--color-border-soft)] px-3 py-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => handleUpload(event.target.files)}
          />

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] px-3 py-2.5 text-left transition hover:border-[var(--color-accent-border-strong)] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!canUpload}
            onClick={() => inputRef.current?.click()}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border-soft)] bg-white text-lg leading-none text-soft">
              <span className="-translate-y-px leading-none">+</span>
            </span>

            <span className="min-w-0">
              <span className="block text-sm font-medium text-main">
                {uploading ? "上传中..." : "添加图片"}
              </span>
              <span className="mt-0.5 block text-xs text-soft">
                支持 jpg、png、webp、gif；每章最多 20 张
              </span>
            </span>
          </button>

          {disabled && (
            <p className="mt-2 text-xs leading-5 text-soft">
              新建章节需要先发布生成 chapter 后，才能上传正文图片。
            </p>
          )}

          {reachedLimit && !disabled && (
            <p className="mt-2 text-xs leading-5 text-soft">
              已达到本章节图片数量上限。
            </p>
          )}

          {errorMessage && (
            <p className="mt-2 text-xs leading-5 text-[var(--color-danger)]">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-soft">
              正在加载图片...
            </p>
          ) : images.length === 0 ? (
            <p className="py-8 text-center text-sm leading-6 text-soft">
              当前章节还没有图片。
              <br />
              上传后可以复制或插入 Markdown 链接。
            </p>
          ) : (
            <div className="space-y-2">
              {images.map((image) => {
                const imageUrl = resolveAssetUrl(image.url);
                const deleting = deletingId === image.id;

                return (
                  <article
                    key={image.id}
                    className="flex gap-3 rounded-xl border border-[var(--color-border-soft)] bg-white p-2"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)]">
                      <img
                        src={imageUrl}
                        alt={image.originalName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-main">
                        {image.originalName}
                      </p>

                      <p className="mt-0.5 text-[11px] text-soft">
                        {formatFileSize(image.size)}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {onInsertMarkdown && (
                          <button
                            type="button"
                            className="rounded-md border border-[var(--color-border-soft)] px-2 py-1 text-[11px] text-muted hover:border-[var(--color-accent-border-strong)] hover:text-[var(--color-accent)]"
                            disabled={deleting}
                            onClick={() => handleInsertMarkdown(image)}
                          >
                            插入
                          </button>
                        )}

                        <button
                          type="button"
                          className="rounded-md border border-[var(--color-border-soft)] px-2 py-1 text-[11px] text-muted hover:border-[var(--color-accent-border-strong)] hover:text-[var(--color-accent)]"
                          disabled={deleting}
                          onClick={() => handleCopyMarkdown(image)}
                        >
                          复制
                        </button>

                        <button
                          type="button"
                          className="rounded-md border border-red-200 px-2 py-1 text-[11px] text-[var(--color-danger)] hover:bg-red-50 disabled:opacity-50"
                          disabled={deleting}
                          onClick={() => handleDelete(image)}
                        >
                          {deleting ? "删除中" : "删除"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}