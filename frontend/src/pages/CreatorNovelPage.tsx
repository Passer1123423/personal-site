import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getMe } from "../api/auth";
import {
  deleteAuthorNovel,
  deleteAuthorNovelChapter,
  fetchAuthorNovelsTree,
  moveAuthorNovelChapter,
  renameAuthorNovel,
  renameAuthorNovelChapter,
  updateAuthorNovelSummary,
  uploadAuthorNovelCover,
  type AuthorNovel,
  type AuthorNovelChapter,
  type MoveDirection,
} from "../api/authorNovels";
import { API_BASE_URL } from "../api/config";

type Message = {
  type: "success" | "error";
  text: string;
};

function resolveCoverUrl(coverUrl?: string | null) {
  if (!coverUrl) {
    return null;
  }

  if (coverUrl.startsWith("http://") || coverUrl.startsWith("https://")) {
    return coverUrl;
  }

  return `${API_BASE_URL}${coverUrl}`;
}

function getChapterCustomTitle(chapter: AuthorNovelChapter) {
  const pattern = new RegExp(`^第\\s*${chapter.displayOrder}\\s*章\\s*`);
  return chapter.title.replace(pattern, "");
}

function EditableChapterTitle({
  chapter,
  disabled,
  onSave,
}: {
  chapter: AuthorNovelChapter;
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
        <span className="text-soft">第{chapter.displayOrder}章</span>

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
  novelSlug,
  chapter,
  submitting,
  onReload,
  onMessage,
}: {
  novelSlug: string;
  chapter: AuthorNovelChapter;
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
      await renameAuthorNovelChapter({
        novelSlug,
        chapterSlug: chapter.slug,
        customTitle,
      });

      await onReload();

      onMessage({
        type: "success",
        text: "章节标题已更新。",
      });
    }, "章节重命名失败");
  }

  async function handleMove(direction: MoveDirection) {
    await runAction(async () => {
      const result = await moveAuthorNovelChapter({
        novelSlug,
        chapterSlug: chapter.slug,
        direction,
      });

      await onReload();

      onMessage({
        type: result.moved ? "success" : "error",
        text: result.moved
          ? "章节顺序已调整。"
          : result.reason ?? "无法移动。",
      });
    }, "移动章节失败");
  }

  async function handleDelete() {
    const confirmed = window.confirm(`确定删除章节「${chapter.title}」吗？`);

    if (!confirmed) {
      return;
    }

    await runAction(async () => {
      await deleteAuthorNovelChapter(novelSlug, chapter.slug);
      await onReload();

      onMessage({
        type: "success",
        text: "章节已删除。",
      });
    }, "删除章节失败");
  }

  return (
    <article className="rounded-2xl border border-[var(--color-border-soft)] bg-white px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-base font-semibold text-main">
            <EditableChapterTitle
              chapter={chapter}
              disabled={submitting}
              onSave={handleRename}
            />
          </div>

          <p className="mt-1 text-xs text-soft">
            slug: {chapter.slug} · order: {chapter.displayOrder}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/creator/novels/${novelSlug}/${chapter.slug}/edit`}
            className="admin-button-primary px-3 py-2 text-xs font-semibold"
          >
            编辑正文
          </Link>

          <button
            type="button"
            className="admin-button-secondary px-3 py-2 text-xs font-semibold"
            disabled={submitting}
            onClick={() => handleMove("up")}
          >
            上移
          </button>

          <button
            type="button"
            className="admin-button-secondary px-3 py-2 text-xs font-semibold"
            disabled={submitting}
            onClick={() => handleMove("down")}
          >
            下移
          </button>

          <button
            type="button"
            className="admin-button-danger px-3 py-2 text-xs font-semibold"
            disabled={submitting}
            onClick={handleDelete}
          >
            删除
          </button>
        </div>
      </div>
    </article>
  );
}

export default function CreatorNovelPage() {
  const { novelSlug } = useParams<{ novelSlug: string }>();
  const navigate = useNavigate();

  const [novel, setNovel] = useState<AuthorNovel | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [titleDraft, setTitleDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [isTitleEditing, setIsTitleEditing] = useState(false);

  const sortedChapters = useMemo(() => {
    return [...(novel?.chapters ?? [])].sort(
      (left, right) => left.displayOrder - right.displayOrder,
    );
  }, [novel]);

  useEffect(() => {
    setSummaryDraft(novel?.summary ?? "");
  }, [novel?.summary]);

  useEffect(() => {
    setTitleDraft(novel?.title ?? "");
  }, [novel?.title]);

  async function loadPageData() {
    if (!novelSlug) {
      setMessage({ type: "error", text: "缺少 novel slug。" });
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await getMe();

      const novels = await fetchAuthorNovelsTree();
      const matched = novels.find((item) => item.slug === novelSlug);

      if (!matched) {
        throw new Error("未找到属于你的 novel。");
      }

      setNovel(matched);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "加载 novel 失败";

      if (
        text === "未登录" ||
        text.includes("Not authenticated") ||
        text.includes("401")
      ) {
        navigate("/admin/login", { replace: true });
        return;
      }

      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, [novelSlug]);

  async function handleSaveTitle() {
    if (!novel) {
      return;
    }

    const title = titleDraft.trim();

    if (!title) {
      setMessage({ type: "error", text: "标题不能为空。" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await renameAuthorNovel(novel.slug, title);
      await loadPageData();
      setIsTitleEditing(false);

      setMessage({
        type: "success",
        text: "标题已保存。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "保存标题失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveSummary() {
    if (!novel) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await updateAuthorNovelSummary(novel.slug, summaryDraft);
      await loadPageData();

      setMessage({
        type: "success",
        text: "简介已保存。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "保存简介失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadCover(file: File | undefined) {
    if (!novel || !file) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await uploadAuthorNovelCover(novel.slug, file);
      await loadPageData();

      setMessage({
        type: "success",
        text: "封面已更新。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "上传封面失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteNovel() {
    if (!novel) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除小说「${novel.title}」吗？此操作会删除全部章节。`,
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await deleteAuthorNovel(novel.slug);
      navigate("/creator/novels", { replace: true });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "删除 novel 失败";
      setMessage({ type: "error", text });
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-page-shell min-h-screen">
      <div className="flex min-h-screen">
        <section className="min-w-0 flex-1 px-6 py-10 transition-all duration-300">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link to="/creator/novels" className="link-accent text-sm">
                  返回小说书架
                </Link>

                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                  Creator Novels
                </p>

                <h1 className="mt-2 text-3xl font-bold text-main">
                  {novel?.title ?? novelSlug ?? "Novel 管理"}
                </h1>

                <p className="mt-3 text-sm text-muted">
                  {novel?.slug ?? novelSlug ?? "-"}
                </p>
              </div>

              <Link
                to={
                  novel
                    ? `/creator/novels/${novel.slug}/new-chapter`
                    : "/creator/novels"
                }
                className="admin-button-primary px-5 py-3 font-semibold"
              >
                新建 chapter
              </Link>
            </div>

            {message && (
              <div
                className={
                  message.type === "success"
                    ? "admin-message-success mb-6 px-4 py-3"
                    : "admin-message-error mb-6 px-4 py-3"
                }
              >
                {message.text}
              </div>
            )}

            {loading ? (
              <section className="admin-section">
                <p className="text-sm text-soft">正在加载 novel 数据...</p>
              </section>
            ) : !novel ? (
              <section className="admin-section">
                <p className="text-sm text-soft">没有找到 novel。</p>
              </section>
            ) : (
              <>
                <section className="admin-section">
                  <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
                    <label className="group relative flex h-60 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--color-border-control)] bg-[var(--color-panel-soft-bg)] text-sm text-soft">
                      {resolveCoverUrl(novel.coverUrl) ? (
                        <img
                          src={resolveCoverUrl(novel.coverUrl) ?? ""}
                          alt={novel.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "Novel 封面"
                      )}

                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-semibold text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                        点击更换封面
                      </div>

                      <input
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={submitting}
                        onChange={(event) => {
                          handleUploadCover(event.currentTarget.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>

                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        {isTitleEditing ? (
                          <>
                            <input
                              className="admin-input px-3 py-2 text-lg font-semibold"
                              value={titleDraft}
                              disabled={submitting}
                              onChange={(event) =>
                                setTitleDraft(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  handleSaveTitle();
                                }

                                if (event.key === "Escape") {
                                  setTitleDraft(novel.title);
                                  setIsTitleEditing(false);
                                }
                              }}
                              autoFocus
                            />

                            <button
                              type="button"
                              className="admin-button-secondary px-3 py-2 text-sm"
                              disabled={submitting}
                              onClick={handleSaveTitle}
                            >
                              保存
                            </button>

                            <button
                              type="button"
                              className="admin-button-danger px-3 py-2 text-sm"
                              disabled={submitting}
                              onClick={() => {
                                setTitleDraft(novel.title);
                                setIsTitleEditing(false);
                              }}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="group inline-flex items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={submitting}
                            title="编辑 novel 标题"
                            onClick={() => {
                              setTitleDraft(novel.title);
                              setIsTitleEditing(true);
                            }}
                          >
                            <h2 className="text-2xl font-bold text-main group-hover:underline group-hover:underline-offset-4">
                              {novel.title}
                            </h2>

                            <span className="admin-button-secondary px-3 py-1 text-sm group-hover:border-[var(--color-accent-border-strong)] group-hover:text-[var(--color-accent)]">
                              ✎
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="mt-4">
                        <label className="text-sm font-semibold text-main">
                          Novel 简介
                        </label>

                        <textarea
                          className="admin-textarea mt-2 min-h-28 w-full px-4 py-3 text-sm leading-7"
                          value={summaryDraft}
                          disabled={submitting}
                          onChange={(event) =>
                            setSummaryDraft(event.target.value)
                          }
                          placeholder="填写这个 novel 的简介。"
                        />

                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                            disabled={submitting}
                            onClick={handleSaveSummary}
                          >
                            保存简介
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="admin-section mt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-main">
                        Chapter 目录
                      </h2>

                      <p className="mt-2 text-sm text-muted">
                        进入页面后直接展示当前 novel 的章节目录。正文编辑在 chapter 编辑页进行。
                      </p>
                    </div>

                    <Link
                      to={`/creator/novels/${novel.slug}/new-chapter`}
                      className="admin-button-primary px-4 py-2 text-sm font-semibold"
                    >
                      新建 chapter
                    </Link>
                  </div>

                  {sortedChapters.length === 0 ? (
                    <div className="admin-muted-panel mt-5 px-4 py-8 text-center text-sm text-soft">
                      当前 novel 暂无 chapter。点击“新建 chapter”进入编辑页。
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {sortedChapters.map((chapter) => (
                        <ChapterRow
                          key={chapter.id}
                          novelSlug={novel.slug}
                          chapter={chapter}
                          submitting={submitting}
                          onReload={loadPageData}
                          onMessage={setMessage}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="admin-button-danger px-4 py-2 text-sm font-semibold"
                    disabled={submitting}
                    onClick={handleDeleteNovel}
                  >
                    删除 novel
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}