import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getMe } from "../api/auth";

import {
  clearAuthorUploadImages,
  deleteAuthorUploadImage,
  fetchAuthorUploadPreviewObjectUrl,
  listAuthorUploadImages,
  publishAuthorComicChapter,
  type AuthorUploadImage,
  uploadAuthorComicImageWithProgress,
} from "../api/authorComicUpload";

import {
  deleteAuthorComicChapter,
  fetchAuthorComicPartDetail,
  moveAuthorComicChapter,
  renameAuthorComicChapter,
  renameAuthorComicPart,
  updateAuthorPartSummary,
  uploadAuthorPartCover,
  type AuthorComicChapter,
  type AuthorComicPartDetail,
  type MoveDirection,
} from "../api/authorComics";

import { API_BASE_URL } from "../api/config";

type Message = {
  type: "success" | "error";
  text: string;
};

type PendingUploadImage = {
  id: string;
  file: File;
  fileName: string;
  sizeBytes: number;
  previewUrl: string;
  progress: number;
  status: "waiting" | "uploading" | "error";
  errorText?: string;
};

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getChapterCustomTitle(chapter: AuthorComicChapter) {
  const pattern = new RegExp(`^第\\s*${chapter.displayOrder}\\s*话\\s*`);
  return chapter.title.replace(pattern, "");
}

function EditableChapterTitle({
  chapter,
  disabled,
  onSave,
}: {
  chapter: AuthorComicChapter;
  disabled: boolean;
  onSave: (customTitle: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(getChapterCustomTitle(chapter));

  useEffect(() => {
    setDraftValue(getChapterCustomTitle(chapter));
  }, [chapter.id, chapter.title, chapter.displayOrder]);

  function startEdit() {
    if (disabled) {
      return;
    }

    setDraftValue(getChapterCustomTitle(chapter));
    setIsEditing(true);
  }

  function cancelEdit() {
    setDraftValue(getChapterCustomTitle(chapter));
    setIsEditing(false);
  }

  async function saveEdit() {
    await onSave(draftValue);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-soft">第{chapter.displayOrder}话</span>

        <input
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              saveEdit();
            }

            if (event.key === "Escape") {
              cancelEdit();
            }
          }}
          className="admin-input w-56 px-2 py-1 text-sm"
          placeholder="标题后缀，可空"
          autoFocus
        />

        <button
          type="button"
          className="admin-button-secondary px-2 py-1 text-xs disabled:opacity-50"
          disabled={disabled}
          onClick={saveEdit}
          title="保存"
        >
          ✓
        </button>

        <button
          type="button"
          className="admin-button-danger px-2 py-1 text-xs disabled:opacity-50"
          disabled={disabled}
          onClick={cancelEdit}
          title="取消"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="group inline-flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={startEdit}
      title="点击编辑章节标题"
    >
      <span className="group-hover:underline group-hover:decoration-[var(--color-accent)] group-hover:underline-offset-4">
        {chapter.title}
      </span>

      <span className="text-xs text-soft group-hover:text-[var(--color-accent)]">
        ✎
      </span>
    </button>
  );
}

function ChapterRow({
  seriesSlug,
  partSlug,
  chapter,
  submitting,
  onReload,
  onMessage,
}: {
  seriesSlug: string;
  partSlug: string;
  chapter: AuthorComicChapter;
  submitting: boolean;
  onReload: () => Promise<void>;
  onMessage: (message: Message) => void;
}) {
  async function runAction(action: () => Promise<void>, fallbackText: string) {
    try {
      await action();
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : fallbackText;
      onMessage({ type: "error", text });
    }
  }

  async function handleRename(customTitle: string) {
    await runAction(async () => {
      await renameAuthorComicChapter({
        seriesSlug,
        partSlug,
        chapterSlug: chapter.slug,
        customTitle,
      });

      onMessage({
        type: "success",
        text: "章节标题已更新。",
      });

      await onReload();
    }, "章节重命名失败");
  }

  async function handleMove(direction: MoveDirection) {
    await runAction(async () => {
      const result = await moveAuthorComicChapter({
        seriesSlug,
        partSlug,
        chapterSlug: chapter.slug,
        direction,
      });

      if (!result.moved) {
        onMessage({
          type: "error",
          text: result.reason ?? "章节顺序未发生变化。",
        });
        return;
      }

      onMessage({
        type: "success",
        text: direction === "up" ? "章节已上移。" : "章节已下移。",
      });

      await onReload();
    }, "章节移动失败");
  }

  async function handleDelete() {
    const confirmed = window.confirm(`确认删除「${chapter.title}」？`);

    if (!confirmed) {
      return;
    }

    await runAction(async () => {
      await deleteAuthorComicChapter({
        seriesSlug,
        partSlug,
        chapterSlug: chapter.slug,
      });

      onMessage({
        type: "success",
        text: "章节已删除。",
      });

      await onReload();
    }, "章节删除失败");
  }

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border-soft)] py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:rounded-[var(--radius-control)] md:border md:bg-[var(--color-panel-soft-bg)] md:px-4 md:py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-main md:text-base">
          <span className="mr-2 text-soft">{chapter.displayOrder}.</span>
          <EditableChapterTitle
            chapter={chapter}
            disabled={submitting}
            onSave={handleRename}
          />
        </p>

        <p className="mt-1 text-sm text-soft">
          {chapter.slug} · {chapter.pageCount ?? 0} 页
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:flex-nowrap">
        <button
          type="button"
          className="admin-button-secondary h-8 w-8 disabled:opacity-50"
          disabled={submitting}
          onClick={() => handleMove("up")}
          title="上移"
        >
          ↑
        </button>

        <button
          type="button"
          className="admin-button-secondary h-8 w-8 disabled:opacity-50"
          disabled={submitting}
          onClick={() => handleMove("down")}
          title="下移"
        >
          ↓
        </button>

        <button
          type="button"
          className="admin-button-danger px-3 py-1 text-sm disabled:opacity-50"
          disabled={submitting}
          onClick={handleDelete}
        >
          删除
        </button>
      </div>
    </div>
  );
}

export default function CreatorComicPartPage() {
  const { seriesSlug, partSlug } = useParams();
  const navigate = useNavigate();

  const [partDetail, setPartDetail] = useState<AuthorComicPartDetail | null>(
    null,
  );

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [images, setImages] = useState<AuthorUploadImage[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUploadImage[]>([]);
  const pendingUploadsRef = useRef<PendingUploadImage[]>([]);
  const [totalSizeBytes, setTotalSizeBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(500 * 1024 * 1024);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const [chapterTitle, setChapterTitle] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const [partSummaryDraft, setPartSummaryDraft] = useState("");
  const [partTitleDraft, setPartTitleDraft] = useState("");
  const [isPartTitleEditing, setIsPartTitleEditing] = useState(false);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    if (!isMobile) {
      return;
    }

    const html = document.documentElement;
    const body = document.body;

    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [drawerOpen]);

  const orderedImageIds = useMemo(
    () => images.map((image) => image.id),
    [images],
  );

  const chapters = partDetail?.chapters ?? [];

  const hasUploadingImages = pendingUploads.some(
    (item) => item.status === "waiting" || item.status === "uploading",
  );

  const visibleUploadCount = images.length + pendingUploads.length;

  const pendingUploadTotalSize = useMemo(
    () => pendingUploads.reduce((sum, item) => sum + item.sizeBytes, 0),
    [pendingUploads],
  );

  useEffect(() => {
    setPartSummaryDraft(partDetail?.part.summary ?? "");
  }, [partDetail?.part.summary]);

  useEffect(() => {
    setPartTitleDraft(partDetail?.part.title ?? "");
  }, [partDetail?.part.title]);

  async function loadPartDetail() {
    if (!seriesSlug || !partSlug) {
      throw new Error("当前路由缺少 seriesSlug 或 partSlug。");
    }

    const data = await fetchAuthorComicPartDetail(seriesSlug, partSlug);
    setPartDetail(data);
  }

  async function refreshUploadImages() {
    const state = await listAuthorUploadImages();

    setImages(state.images);
    setTotalSizeBytes(state.totalSizeBytes);
    setLimitBytes(state.limitBytes);
  }

  async function loadPageData() {
    setPageLoading(true);
    setMessage(null);

    try {
      await getMe();
      await Promise.all([loadPartDetail(), refreshUploadImages()]);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "加载页面失败";

      if (
        text === "未登录" ||
        text.includes("Not authenticated") ||
        text.includes("401")
      ) {
        navigate("/admin/login", { replace: true });
        return;
      }

      setMessage({
        type: "error",
        text,
      });
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, [seriesSlug, partSlug]);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadPreviewUrls() {
      const entries = await Promise.all(
        images.map(async (image) => {
          try {
            const objectUrl = await fetchAuthorUploadPreviewObjectUrl(
              image.previewUrl,
            );

            createdUrls.push(objectUrl);
            return [image.id, objectUrl] as const;
          } catch {
            return [image.id, ""] as const;
          }
        }),
      );

      if (cancelled) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setPreviewUrls(Object.fromEntries(entries));
    }

    loadPreviewUrls();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  useEffect(() => {
    return () => {
      pendingUploadsRef.current.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl),
      );
    };
  }, []);

  function updatePendingUpload(
    id: string,
    updater: (item: PendingUploadImage) => PendingUploadImage,
  ) {
    setPendingUploads((current) =>
      current.map((item) => (item.id === id ? updater(item) : item)),
    );
  }

  function removePendingUpload(id: string) {
    setPendingUploads((current) => {
      const target = current.find((item) => item.id === id);

      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    const selectedFiles = Array.from(files);

    const pendingItems: PendingUploadImage[] = selectedFiles.map((file, index) => ({
      id: `pending-${Date.now()}-${index}-${Math.random()
        .toString(36)
        .slice(2)}`,
      file,
      fileName: file.name,
      sizeBytes: file.size,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "waiting",
    }));

    setPendingUploads((current) => [...current, ...pendingItems]);
    setSubmitting(true);
    setMessage(null);

    let savedCount = 0;
    const rejected: { filename: string; reason: string }[] = [];

    try {
      for (const item of pendingItems) {
        updatePendingUpload(item.id, (current) => ({
          ...current,
          status: "uploading",
        }));

        try {
          const result = await uploadAuthorComicImageWithProgress(
            item.file,
            (progress) => {
              updatePendingUpload(item.id, (current) => ({
                ...current,
                progress,
              }));
            },
          );

          savedCount += result.saved.length;
          rejected.push(...result.rejected);

          removePendingUpload(item.id);
          await refreshUploadImages();
        } catch (error: unknown) {
          const text = error instanceof Error ? error.message : "上传失败";

          rejected.push({
            filename: item.fileName,
            reason: text,
          });

          updatePendingUpload(item.id, (current) => ({
            ...current,
            progress: 100,
            status: "error",
            errorText: text,
          }));
        }
      }

      await refreshUploadImages();

      if (rejected.length > 0) {
        setMessage({
          type: "error",
          text: `已上传 ${savedCount} 张，失败或拒绝 ${rejected.length} 张。`,
        });
      } else {
        setMessage({
          type: "success",
          text: `已上传 ${savedCount} 张图片。`,
        });
      }
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "上传失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  function handleRemovePendingUpload(id: string) {
    removePendingUpload(id);
  }

  async function handleDeleteImage(imageId: string) {
    setSubmitting(true);
    setMessage(null);

    try {
      const state = await deleteAuthorUploadImage(imageId);
      setImages(state.images);
      setTotalSizeBytes(state.totalSizeBytes);
      setLimitBytes(state.limitBytes);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "删除失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClearImages() {
    if (images.length === 0) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const state = await clearAuthorUploadImages();

      setImages(state.images);
      setTotalSizeBytes(state.totalSizeBytes);
      setLimitBytes(state.limitBytes);

      setMessage({
        type: "success",
        text: "已清空待传区。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "清空失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadPartCover(file: File | null | undefined) {
    if (!file || !seriesSlug || !partSlug) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await uploadAuthorPartCover({
        seriesSlug,
        partSlug,
        file,
      });

      await loadPartDetail();

      setMessage({
        type: "success",
        text: "Part 封面已更新。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "封面上传失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePartSummary() {
    if (!seriesSlug || !partSlug) {
      setMessage({
        type: "error",
        text: "当前路由缺少 seriesSlug 或 partSlug。",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await updateAuthorPartSummary({
        seriesSlug,
        partSlug,
        summary: partSummaryDraft,
      });

      await loadPartDetail();

      setMessage({
        type: "success",
        text: "Part 简介已保存。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "简介保存失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePartTitle() {
    if (!seriesSlug || !partSlug) {
      setMessage({
        type: "error",
        text: "当前路由缺少 seriesSlug 或 partSlug。",
      });
      return;
    }

    const title = partTitleDraft.trim();

    if (!title) {
      setMessage({
        type: "error",
        text: "Part 标题不能为空。",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await renameAuthorComicPart({
        seriesSlug,
        partSlug,
        title,
      });

      await loadPartDetail();
      setIsPartTitleEditing(false);

      setMessage({
        type: "success",
        text: "Part 标题已更新。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Part 重命名失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish() {
    if (!seriesSlug || !partSlug) {
      setMessage({
        type: "error",
        text: "当前路由缺少 seriesSlug 或 partSlug。",
      });
      return;
    }

    if (hasUploadingImages) {
      setMessage({
        type: "error",
        text: "仍有图片正在上传，请等待上传完成。",
      });
      return;
    }

    if (images.length === 0) {
      setMessage({
        type: "error",
        text: "待传区没有图片。",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await publishAuthorComicChapter({
        series_slug: seriesSlug,
        part_slug: partSlug,
        chapter_title: chapterTitle.trim() || null,
        ordered_image_ids: orderedImageIds,
      });

      await Promise.all([refreshUploadImages(), loadPartDetail()]);
      setChapterTitle("");

      setMessage({
        type: "success",
        text: `已发布 ${result.chapter.title}，共 ${result.pageCount} 页。`,
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "发布失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-page-shell min-h-[100dvh]">
      <div className="min-h-[100dvh] md:flex">
        <section className="min-w-0 flex-1 px-4 py-7 transition-all duration-300 md:px-6 md:py-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 md:mb-6 md:items-center md:gap-4">
              <div>
                <Link
                  to={seriesSlug ? `/creator/comics/${seriesSlug}` : "/creator/comics"}
                  className="link-accent text-sm"
                >
                  返回
                </Link>

                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] link-accent md:text-sm md:tracking-[0.25em] max-md:hidden">
                  Creator Comics
                </p>

                <h1 className="mt-2 text-2xl font-bold leading-tight text-main md:text-3xl">
                  {partDetail?.part.title ?? partSlug ?? "Part"} 作者页
                </h1>

                <p className="mt-2 text-sm text-muted md:mt-3">
                  {seriesSlug ?? "-"} / {partSlug ?? "-"}
                </p>
              </div>

              <button
                type="button"
                className="admin-button-primary px-4 py-2 text-sm font-semibold md:px-5 md:py-3 md:text-base"
                onClick={() => setDrawerOpen(true)}
              >
                上传新章节
              </button>
            </div>

            {message && (
              <div
                className={
                  message.type === "success"
                    ? "admin-message-success mb-5 px-4 py-3 text-sm md:mb-6"
                    : "admin-message-error mb-5 px-4 py-3 text-sm md:mb-6"
                }
              >
                {message.text}
              </div>
            )}

            {pageLoading ? (
              <section className="border-y border-[var(--color-border-soft)] py-5 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:p-5 md:shadow-[var(--shadow-card)]">
                <p className="text-sm text-soft">正在加载 part 数据...</p>
              </section>
            ) : (
              <>
                <section className="border-y border-[var(--color-border-soft)] py-5 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:p-5 md:shadow-[var(--shadow-card)]">
                  <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-4 gap-y-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
                    <label className="group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-sm border border-dashed border-[var(--color-border-control)] bg-[var(--color-panel-soft-bg)] text-xs text-soft md:h-60 md:rounded-2xl md:text-sm">
                      {partDetail?.part.coverUrl ? (
                        <img
                          src={`${API_BASE_URL}${partDetail.part.coverUrl}`}
                          alt={partDetail.part.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "Part 封面"
                      )}

                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 px-2 text-center text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 md:text-sm">
                        点击更换封面
                      </div>

                      <input
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={submitting}
                        onChange={(event) => {
                          handleUploadPartCover(event.currentTarget.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        {isPartTitleEditing ? (
                          <>
                            <input
                              className="admin-input min-w-0 flex-1 px-3 py-2 text-base font-semibold md:text-lg"
                              value={partTitleDraft}
                              disabled={submitting}
                              onChange={(event) => setPartTitleDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  handleSavePartTitle();
                                }

                                if (event.key === "Escape") {
                                  setPartTitleDraft(partDetail?.part.title ?? "");
                                  setIsPartTitleEditing(false);
                                }
                              }}
                              autoFocus
                            />

                            <button
                              type="button"
                              className="admin-button-secondary px-3 py-2 text-sm"
                              disabled={submitting}
                              onClick={handleSavePartTitle}
                            >
                              保存
                            </button>

                            <button
                              type="button"
                              className="admin-button-danger px-3 py-2 text-sm"
                              disabled={submitting}
                              onClick={() => {
                                setPartTitleDraft(partDetail?.part.title ?? "");
                                setIsPartTitleEditing(false);
                              }}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="group inline-flex min-w-0 items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 md:gap-3"
                            disabled={submitting}
                            title="编辑 part 标题"
                            onClick={() => {
                              setPartTitleDraft(partDetail?.part.title ?? "");
                              setIsPartTitleEditing(true);
                            }}
                          >
                            <h2 className="line-clamp-2 text-lg font-bold leading-6 text-main group-hover:underline group-hover:underline-offset-4 md:text-2xl md:leading-tight">
                              {partDetail?.part.title ?? partSlug}
                            </h2>

                            <span className="admin-button-secondary px-2 py-1 text-xs group-hover:border-[var(--color-accent-border-strong)] group-hover:text-[var(--color-accent)] md:px-3 md:text-sm">
                              ✎
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="mt-3 text-xs leading-5 text-soft md:mt-4 md:text-sm md:leading-6">
                        <p>{seriesSlug ?? "-"} / {partSlug ?? "-"}</p>
                        <p className="mt-1">{chapters.length} 个 chapter</p>
                      </div>

                      <div className="mt-3 hidden md:mt-4 md:block">
                        <label className="text-sm font-semibold text-main">Part 简介</label>

                        <textarea
                          className="admin-textarea mt-2 min-h-28 w-full px-4 py-3 text-sm leading-7"
                          value={partSummaryDraft}
                          disabled={submitting}
                          onChange={(event) => setPartSummaryDraft(event.target.value)}
                          placeholder="填写这个 part 的简介。"
                        />

                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                            disabled={submitting}
                            onClick={handleSavePartSummary}
                          >
                            保存简介
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 md:hidden">
                      <label className="text-sm font-semibold text-main">Part 简介</label>

                      <textarea
                        className="admin-textarea mt-2 min-h-24 w-full px-3 py-2.5 text-sm leading-6"
                        value={partSummaryDraft}
                        disabled={submitting}
                        onChange={(event) => setPartSummaryDraft(event.target.value)}
                        placeholder="填写这个 part 的简介。"
                      />

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                          disabled={submitting}
                          onClick={handleSavePartSummary}
                        >
                          保存简介
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mt-5 border-y border-[var(--color-border-soft)] py-5 md:mt-6 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:p-5 md:shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap items-start justify-between gap-3 md:items-center">
                    <div>
                      <h2 className="text-lg font-semibold text-main md:text-xl">
                        Chapter 目录
                      </h2>

                      <p className="mt-1.5 text-sm leading-6 text-muted md:mt-2">
                        进入页面后直接展示当前 part 的章节目录。上传只在右侧缓存区进行。
                      </p>
                    </div>

                    <button
                      type="button"
                      className="admin-button-primary flex-1 px-4 py-2 text-sm font-semibold md:flex-none"
                      onClick={() => setDrawerOpen(true)}
                    >
                      上传新章节
                    </button>
                  </div>

                  {chapters.length === 0 ? (
                    <div className="mt-4 border-t border-[var(--color-border-soft)] px-2 py-6 text-center text-sm text-soft md:mt-5 md:rounded-[var(--radius-control)] md:border md:border-[var(--color-border-soft)] md:bg-[var(--color-panel-soft-bg)] md:px-4 md:py-8">
                      当前 part 暂无 chapter。点击“上传新章节”打开右侧缓存区。
                    </div>
                  ) : (
                    <div className="mt-4 space-y-0 md:mt-5 md:space-y-3">
                      {chapters.map((chapter) => (
                        <ChapterRow
                          key={chapter.id}
                          seriesSlug={seriesSlug ?? ""}
                          partSlug={partSlug ?? ""}
                          chapter={chapter}
                          submitting={submitting}
                          onReload={loadPartDetail}
                          onMessage={setMessage}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </section>

        <aside
          className={[
            "border-l border-[var(--color-border-soft)] bg-[var(--color-panel-bg)] shadow-xl transition-transform duration-300 max-md:fixed max-md:inset-0 max-md:z-40 max-md:h-[100dvh] max-md:overflow-hidden max-md:overscroll-contain md:sticky md:top-0 md:z-auto md:h-[100dvh] md:shrink-0 md:transition-[width]",
            drawerOpen
              ? "translate-x-0 md:w-[48vw] md:min-w-[560px] md:max-w-[820px]"
              : "translate-x-full md:w-0 md:translate-x-0",
          ].join(" ")}
        >
          {drawerOpen && (
            <section className="flex h-full min-h-0 flex-col">
              <header className="shrink-0 border-b border-[var(--color-border-soft)] px-4 py-4 md:px-6 md:py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-main md:text-xl">
                      待传缓存区
                    </h2>

                    <p className="mt-1.5 text-sm leading-6 text-muted md:mt-2">
                      图片先进入当前用户缓存区，发布后才写入正式漫画目录。
                    </p>
                  </div>

                  <button
                    type="button"
                    className="admin-button-secondary px-3 py-2 text-sm"
                    onClick={() => setDrawerOpen(false)}
                  >
                    收起
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-5">
                <section className="flex h-full min-h-0 flex-col gap-4 md:gap-5">
                  <div className="flex min-h-0 flex-1 flex-col border-y border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] py-3 md:rounded-2xl md:border md:p-4">
                    <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-main">
                          图片预览
                        </h3>
                        <p className="mt-1 text-xs text-soft">
                          当前 {visibleUploadCount} 张，按显示顺序发布。
                        </p>
                      </div>

                      <span className="shrink-0 text-xs text-soft">
                        {formatBytes(totalSizeBytes + pendingUploadTotalSize)} / {formatBytes(limitBytes)}
                      </span>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                      {visibleUploadCount === 0 ? (
                        <div className="flex h-full min-h-48 items-center justify-center rounded-xl border border-dashed border-[var(--color-border-control)] bg-white px-4 py-10 text-center text-sm text-soft">
                          待传区为空。点击下方区域上传新章节图片。
                        </div>
                      ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 md:grid-cols-[repeat(auto-fill,minmax(116px,1fr))] md:gap-3">
                          {images.map((image) => (
                            <article
                              key={image.id}
                              className="overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-white md:rounded-xl"
                            >
                              <div className="flex h-24 items-center justify-center bg-[var(--color-panel-muted-bg)] md:h-28">
                                {previewUrls[image.id] ? (
                                  <img
                                    src={previewUrls[image.id]}
                                    alt={image.originalFilename}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <span className="text-xs text-soft">加载中</span>
                                )}
                              </div>

                              <div className="space-y-1.5 px-2 py-2 md:space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="badge-accent px-2 py-0.5 text-xs">
                                    #{image.displayOrder}
                                  </span>

                                  <span className="text-[11px] text-soft">
                                    {formatBytes(image.sizeBytes)}
                                  </span>
                                </div>

                                <p className="truncate text-xs font-medium text-main">
                                  {image.originalFilename}
                                </p>

                                <button
                                  type="button"
                                  className="admin-button-danger w-full px-2 py-1 text-xs"
                                  disabled={submitting}
                                  onClick={() => handleDeleteImage(image.id)}
                                >
                                  删除
                                </button>
                              </div>
                            </article>
                          ))}

                          {pendingUploads.map((item, index) => (
                            <article
                              key={item.id}
                              className="overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-white md:rounded-xl"
                            >
                              <div className="relative flex h-24 items-center justify-center bg-[var(--color-panel-muted-bg)] md:h-28">
                                <img
                                  src={item.previewUrl}
                                  alt={item.fileName}
                                  className="h-full w-full object-contain opacity-80"
                                />

                                {item.status !== "error" && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-white/45 text-xs font-semibold text-main">
                                    {item.status === "waiting" ? "等待中" : "上传中"}
                                  </div>
                                )}

                                {item.status === "error" && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 px-2 text-center text-xs font-semibold text-red-600">
                                    上传失败
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5 px-2 py-2 md:space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="badge-accent px-2 py-0.5 text-xs">
                                    #{images.length + index + 1}
                                  </span>

                                  <span className="text-[11px] text-soft">
                                    {formatBytes(item.sizeBytes)}
                                  </span>
                                </div>

                                <p className="truncate text-xs font-medium text-main">
                                  {item.fileName}
                                </p>

                                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-panel-muted-bg)]">
                                  <div
                                    className={
                                      item.status === "error"
                                        ? "h-full rounded-full bg-red-400 transition-all duration-150"
                                        : "h-full rounded-full bg-[var(--color-accent)] transition-all duration-150"
                                    }
                                    style={{
                                      width: `${item.progress}%`,
                                    }}
                                  />
                                </div>

                                <p className="truncate text-[11px] text-soft">
                                  {item.status === "error"
                                    ? item.errorText ?? "上传失败"
                                    : item.status === "waiting"
                                      ? "等待上传"
                                      : `${item.progress}%`}
                                </p>

                                {item.status === "error" && (
                                  <button
                                    type="button"
                                    className="admin-button-danger w-full px-2 py-1 text-xs"
                                    onClick={() => handleRemovePendingUpload(item.id)}
                                  >
                                    移除
                                  </button>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <label className="block cursor-pointer rounded-xl border border-dashed border-[var(--color-border-control)] bg-[var(--color-panel-soft-bg)] px-4 py-3 text-center text-sm text-muted hover:border-[var(--color-accent-border-strong)] md:rounded-2xl">
                      <span className="font-semibold text-main">选择图片上传</span>
                      <span className="mt-1 block text-xs">
                        支持 jpg、jpeg、png、webp
                      </span>

                      <input
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={submitting}
                        onChange={(event) => {
                          handleUploadFiles(event.currentTarget.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>

                    <div className="mt-4">
                      <label className="text-sm font-semibold text-main">
                        新章节标题后缀
                      </label>

                      <input
                        className="admin-input mt-2 w-full px-3 py-2.5 md:px-4 md:py-3"
                        value={chapterTitle}
                        onChange={(event) => setChapterTitle(event.target.value)}
                        placeholder="可空，例如：开始"
                      />

                      <p className="mt-2 text-xs text-soft">
                        后端会生成“第N话”，这里只填后缀。
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <footer className="shrink-0 border-t border-[var(--color-border-soft)] bg-[var(--color-panel-bg)] px-4 py-3 md:px-6 md:py-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="admin-button-primary flex-1 px-4 py-2 text-sm font-semibold md:flex-none"
                    disabled={submitting || hasUploadingImages || images.length === 0}
                    onClick={handlePublish}
                  >
                    发布 chapter
                  </button>

                  <button
                    type="button"
                    className="admin-button-danger flex-1 px-4 py-2 text-sm font-semibold md:flex-none"
                    disabled={submitting || hasUploadingImages || images.length === 0}
                    onClick={handleClearImages}
                  >
                    清空缓存区
                  </button>
                </div>
              </footer>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
