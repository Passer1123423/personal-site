import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  createAdminNovel,
  createAdminNovelChapter,
  deleteAdminNovel,
  deleteAdminNovelChapter,
  fetchAdminNovelOwnerCandidates,
  fetchAdminNovelsTree,
  moveAdminNovelChapter,
  renameAdminNovel,
  renameAdminNovelChapter,
  setAdminNovelOwner,
  type AdminNovel,
  type AdminNovelChapter,
  type AdminNovelOwner,
} from "../api/adminNovels";
import { clearAccessToken, getMe } from "../api/auth";
import { formatChinaDateTimeToMinute } from "../utils/time";

type MoveDirection = "up" | "down";

function MessageArea({
  errorMessage,
  successMessage,
}: {
  errorMessage: string;
  successMessage: string;
}) {
  return (
    <>
      {errorMessage && (
        <section className="admin-message-error p-4">{errorMessage}</section>
      )}

      {successMessage && (
        <section className="admin-message-success p-4">
          {successMessage}
        </section>
      )}
    </>
  );
}

function getChapterPrefix(chapter: AdminNovelChapter) {
  return `第${chapter.displayOrder}章`;
}

function getChapterCustomTitle(chapter: AdminNovelChapter): string {
  const prefixPattern = new RegExp(
    `^第\\s*${chapter.displayOrder}\\s*章\\s*`,
  );

  return chapter.title.replace(prefixPattern, "").trim();
}

function sortNovelsForSelect(novels: AdminNovel[]) {
  return [...novels].sort((a, b) => {
    return a.slug.localeCompare(b.slug, "en", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function makeNextNovelSlug(novels: AdminNovel[]) {
  const usedNumbers = novels
    .map((novel) => {
      const match = novel.slug.match(/^novel-(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => value > 0);

  const nextNumber =
    usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;

  return `novel-${String(nextNumber).padStart(3, "0")}`;
}

function makeNextChapterSlug(chapters: AdminNovelChapter[]) {
  const usedNumbers = chapters
    .map((chapter) => {
      const match = chapter.slug.match(/^chapter-(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => value > 0);

  let nextNumber = 1;

  while (usedNumbers.includes(nextNumber)) {
    nextNumber += 1;
  }

  return `chapter-${String(nextNumber).padStart(3, "0")}`;
}

function InlineNovelTitleEditor({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  function cancelEdit() {
    setDraftValue(value);
    setIsEditing(false);
  }

  async function saveEdit() {
    await onSave(draftValue);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <span className="inline-flex max-w-full flex-wrap items-center gap-2">
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
          className="admin-input min-w-[220px] px-2 py-1 text-sm"
          autoFocus
        />

        <button
          type="button"
          onClick={saveEdit}
          disabled={disabled}
          className="admin-button-secondary px-2 py-1 text-xs disabled:opacity-50"
          title="保存"
        >
          ✓
        </button>

        <button
          type="button"
          onClick={cancelEdit}
          disabled={disabled}
          className="admin-button-danger px-2 py-1 text-xs disabled:opacity-50"
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
      onClick={() => {
        if (!disabled) {
          setIsEditing(true);
        }
      }}
      disabled={disabled}
      className="inline-flex max-w-full items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      title="点击重命名"
    >
      <span className="truncate hover:underline">{value}</span>
      <span className="text-xs text-soft">✎</span>
    </button>
  );
}

function InlineChapterTitleEditor({
  chapter,
  disabled,
  onSave,
}: {
  chapter: AdminNovelChapter;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const prefix = getChapterPrefix(chapter);
  const customTitle = getChapterCustomTitle(chapter);

  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(customTitle);

  useEffect(() => {
    setDraftValue(customTitle);
  }, [customTitle]);

  function cancelEdit() {
    setDraftValue(customTitle);
    setIsEditing(false);
  }

  async function saveEdit() {
    await onSave(draftValue);
    setIsEditing(false);
  }

  return (
    <div className="inline-flex min-w-0 flex-wrap items-center gap-1">
      <span>{prefix}</span>

      {isEditing ? (
        <>
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
            className="admin-input min-w-[160px] px-2 py-1 text-sm"
            placeholder="标题后缀"
            autoFocus
          />

          <button
            type="button"
            onClick={saveEdit}
            disabled={disabled}
            className="admin-button-secondary px-2 py-1 text-xs disabled:opacity-50"
          >
            ✓
          </button>

          <button
            type="button"
            onClick={cancelEdit}
            disabled={disabled}
            className="admin-button-danger px-2 py-1 text-xs disabled:opacity-50"
          >
            ×
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();

            if (!disabled) {
              setIsEditing(true);
            }
          }}
          disabled={disabled}
          className="inline-flex min-w-0 items-center gap-2 text-left font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          title="点击重命名标题后缀"
        >
          <span className="truncate hover:underline">
            {customTitle || "未命名"}
          </span>
          <span className="text-xs text-soft">✎</span>
        </button>
      )}
    </div>
  );
}

function NovelSelector({
  novels,
  selectedNovel,
  disabled,
  onSelect,
}: {
  novels: AdminNovel[];
  selectedNovel: AdminNovel | null;
  disabled: boolean;
  onSelect: (novelSlug: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  const sortedNovels = useMemo(() => sortNovelsForSelect(novels), [novels]);

  const filteredNovels = useMemo(() => {
    const value = keyword.trim().toLowerCase();

    if (!value) {
      return sortedNovels;
    }

    return sortedNovels.filter((novel) => {
      return (
        novel.title.toLowerCase().includes(value) ||
        novel.slug.toLowerCase().includes(value)
      );
    });
  }, [keyword, sortedNovels]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen((previous) => !previous);
          }
        }}
        disabled={disabled}
        className="admin-select flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 truncate text-main">
          {selectedNovel
            ? `${selectedNovel.title}（${selectedNovel.slug}）`
            : "选择小说"}
        </span>

        <span className="shrink-0 text-xs text-soft">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-panel-bg)] p-2 shadow-lg">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="admin-input w-full px-3 py-2 text-sm"
            placeholder="搜索标题或 slug"
            autoFocus
          />

          <div className="mt-2 max-h-64 overflow-auto">
            {filteredNovels.length === 0 && (
              <p className="px-2 py-3 text-sm text-soft">没有匹配的小说。</p>
            )}

            {filteredNovels.map((novel) => {
              const isSelected = novel.slug === selectedNovel?.slug;

              return (
                <button
                  key={novel.id}
                  type="button"
                  onClick={() => {
                    onSelect(novel.slug);
                    setIsOpen(false);
                    setKeyword("");
                  }}
                  className={
                    isSelected
                      ? "w-full border-l-2 border-[var(--color-accent-border-strong)] bg-[var(--color-panel-soft-bg)] px-3 py-2 text-left"
                      : "w-full border-l-2 border-transparent px-3 py-2 text-left hover:bg-[var(--color-panel-soft-bg)]"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={
                        isSelected
                          ? "min-w-0 truncate text-sm font-semibold text-main"
                          : "min-w-0 truncate text-sm text-main"
                      }
                    >
                      {novel.title}
                    </span>

                    <span className="shrink-0 text-xs text-soft">
                      {novel.chapters.length} 章
                    </span>
                  </div>

                  <p className="mt-0.5 truncate text-xs text-soft">
                    {novel.slug}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminNovelsPage() {
  const navigate = useNavigate();

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [novels, setNovels] = useState<AdminNovel[]>([]);
  const [ownerCandidates, setOwnerCandidates] = useState<AdminNovelOwner[]>([]);

  const [selectedNovelSlug, setSelectedNovelSlug] = useState("");
  const [selectedChapterSlug, setSelectedChapterSlug] = useState("");

  const [newNovelSlug, setNewNovelSlug] = useState("");
  const [newNovelTitle, setNewNovelTitle] = useState("");

  const [newChapterSlug, setNewChapterSlug] = useState("");
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterContent, setNewChapterContent] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function checkLogin() {
      try {
        const user = await getMe();

        if (user.role !== "admin") {
          navigate("/admin/login", { replace: true });
          return;
        }

        setIsAuthReady(true);
      } catch {
        clearAccessToken();
        navigate("/admin/login", { replace: true });
      }
    }

    checkLogin();
  }, [navigate]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    loadPageData();
  }, [isAuthReady]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setErrorMessage("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [errorMessage]);

  const selectedNovel = useMemo(() => {
    return novels.find((novel) => novel.slug === selectedNovelSlug) ?? null;
  }, [novels, selectedNovelSlug]);

  const selectedChapter = useMemo(() => {
    if (!selectedNovel) {
      return null;
    }

    return (
      selectedNovel.chapters.find(
        (chapter) => chapter.slug === selectedChapterSlug,
      ) ?? null
    );
  }, [selectedNovel, selectedChapterSlug]);

  async function loadPageData(
    nextNovelSlug?: string,
    nextChapterSlug?: string,
  ) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [treeResult, ownerResult] = await Promise.all([
        fetchAdminNovelsTree(),
        fetchAdminNovelOwnerCandidates(),
      ]);

      setNovels(treeResult);
      setOwnerCandidates(ownerResult);
      setNewNovelSlug((previous) => {
        if (previous.trim()) {
          return previous;
        }

        return makeNextNovelSlug(treeResult);
      });

      const sortedTree = sortNovelsForSelect(treeResult);

      const targetNovelSlug =
        nextNovelSlug || selectedNovelSlug || sortedTree[0]?.slug || "";

      const targetNovel =
        treeResult.find((novel) => novel.slug === targetNovelSlug) ??
        sortedTree[0] ??
        null;

      setSelectedNovelSlug(targetNovel?.slug ?? "");

      if (!targetNovel) {
        setSelectedChapterSlug("");
        setNewChapterSlug("");
        return;
      }

      setNewChapterSlug((previous) => {
        if (previous.trim()) {
          return previous;
        }

        return makeNextChapterSlug(targetNovel.chapters);
      });

      const targetChapterSlug =
        nextChapterSlug ||
        selectedChapterSlug ||
        targetNovel.chapters[0]?.slug ||
        "";

      const targetChapter =
        targetNovel.chapters.find(
          (chapter) => chapter.slug === targetChapterSlug,
        ) ??
        targetNovel.chapters[0] ??
        null;

      setSelectedChapterSlug(targetChapter?.slug ?? "");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "小说后台数据加载失败。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function runMutation(action: () => Promise<void>, successText: string) {
    setSubmitting(true);
    clearMessages();

    try {
      await action();
      setSuccessMessage(successText);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "操作失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateNovel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runMutation(async () => {
      const novel = await createAdminNovel({
        slug: newNovelSlug.trim(),
        title: newNovelTitle.trim() || undefined,
      });

      setNewNovelSlug(makeNextNovelSlug([...novels, novel]));
      setNewNovelTitle("");

      await loadPageData(novel.slug, "");
    }, "小说已创建。");
  }

  async function handleCreateChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedNovel) {
      setErrorMessage("请先选择小说。");
      return;
    }

    await runMutation(async () => {
      const chapter = await createAdminNovelChapter({
        novelSlug: selectedNovel.slug,
        slug: newChapterSlug.trim(),
        customTitle: newChapterTitle.trim(),
        content: newChapterContent,
      });

      setNewChapterSlug(
        makeNextChapterSlug([...selectedNovel.chapters, chapter]),
      );
      setNewChapterTitle("");
      setNewChapterContent("");

      await loadPageData(selectedNovel.slug, chapter.slug);
    }, "章节已创建。");
  }

  async function handleRenameNovel(novel: AdminNovel, title: string) {
    await runMutation(async () => {
      await renameAdminNovel({
        novelSlug: novel.slug,
        title: title.trim(),
      });

      await loadPageData(novel.slug, selectedChapterSlug);
    }, "小说标题已更新。");
  }

  async function handleRenameChapter(
    novel: AdminNovel,
    chapter: AdminNovelChapter,
    customTitle: string,
  ) {
    await runMutation(async () => {
      await renameAdminNovelChapter({
        novelSlug: novel.slug,
        chapterSlug: chapter.slug,
        customTitle: customTitle.trim(),
      });

      await loadPageData(novel.slug, chapter.slug);
    }, "章节标题已更新。");
  }

  async function handleMoveChapter(
    novel: AdminNovel,
    chapter: AdminNovelChapter,
    direction: MoveDirection,
  ) {
    await runMutation(async () => {
      const result = await moveAdminNovelChapter({
        novelSlug: novel.slug,
        chapterSlug: chapter.slug,
        direction,
      });

      await loadPageData(novel.slug, chapter.slug);

      if (result.reason) {
        setSuccessMessage(result.reason);
      }
    }, "章节顺序已更新。");
  }

  async function handleSetOwner(novel: AdminNovel, username: string) {
    await runMutation(async () => {
      await setAdminNovelOwner({
        novelSlug: novel.slug,
        username: username || null,
      });

      await loadPageData(novel.slug, selectedChapterSlug);
    }, "小说作者归属已更新。");
  }

  async function handleDeleteChapter(
    novel: AdminNovel,
    chapter: AdminNovelChapter,
  ) {
    const confirmed = window.confirm(`确定删除章节《${chapter.title}》吗？`);

    if (!confirmed) {
      return;
    }

    await runMutation(async () => {
      await deleteAdminNovelChapter({
        novelSlug: novel.slug,
        chapterSlug: chapter.slug,
      });

      await loadPageData(novel.slug, "");
    }, "章节已删除。");
  }

  async function handleDeleteNovel(novel: AdminNovel) {
    const confirmed = window.confirm(
      `确定删除小说《${novel.title}》吗？该操作会删除其全部章节。`,
    );

    if (!confirmed) {
      return;
    }

    await runMutation(async () => {
      await deleteAdminNovel({
        novelSlug: novel.slug,
      });

      await loadPageData("", "");
    }, "小说已删除。");
  }

  function handleSelectNovel(novelSlug: string) {
    const novel = novels.find((item) => item.slug === novelSlug);

    setSelectedNovelSlug(novelSlug);
    setSelectedChapterSlug(novel?.chapters[0]?.slug ?? "");

    if (novel) {
      setNewChapterSlug(makeNextChapterSlug(novel.chapters));
    } else {
      setNewChapterSlug("");
    }
  }

  if (!isAuthReady) {
    return (
      <main className="admin-page-shell px-6 py-10">
        <section className="mx-auto max-w-6xl">
          <p className="text-sm text-soft">正在检查登录状态...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page-shell px-6 py-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              to="/admin"
              className="mb-3 inline-block text-sm font-semibold link-accent"
            >
              ← 返回后台首页
            </Link>

            <p className="text-sm text-soft">Admin Console</p>
            <h1 className="mt-2 text-3xl font-semibold text-main">
              小说管理
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              管理小说目录、章节标题、章节顺序和作者归属。正文编辑留给作者侧功能。
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadPageData()}
            disabled={isLoading || submitting}
            className="admin-button-secondary px-4 py-2 text-sm disabled:opacity-50"
          >
            刷新
          </button>
        </div>

        <MessageArea
          errorMessage={errorMessage}
          successMessage={successMessage}
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section className="admin-section">
            <h2 className="text-xl font-semibold text-main">创建小说</h2>

            <form onSubmit={handleCreateNovel} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm text-muted">小说 slug</span>
                <input
                  value={newNovelSlug}
                  onChange={(event) => setNewNovelSlug(event.target.value)}
                  className="admin-input mt-1 w-full px-3 py-2 text-sm"
                  placeholder="例如：saba-history"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm text-muted">标题，可空</span>
                <input
                  value={newNovelTitle}
                  onChange={(event) => setNewNovelTitle(event.target.value)}
                  className="admin-input mt-1 w-full px-3 py-2 text-sm"
                  placeholder="默认：未命名小说"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="admin-button-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                创建小说
              </button>
            </form>
          </section>

          <section className="admin-section">
            <div className="mb-5">
              <NovelSelector
                novels={novels}
                selectedNovel={selectedNovel}
                disabled={isLoading || submitting}
                onSelect={handleSelectNovel}
              />
            </div>

            {!selectedNovel && (
              <p className="text-sm text-soft">
                请选择小说，或先创建一部小说。
              </p>
            )}

            {selectedNovel && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-soft">当前小说</p>
                    <h2 className="mt-1 max-w-full text-2xl font-semibold text-main">
                      <InlineNovelTitleEditor
                        value={selectedNovel.title}
                        disabled={submitting}
                        onSave={(value) =>
                          handleRenameNovel(selectedNovel, value)
                        }
                      />
                    </h2>
                    <p className="mt-1 text-sm text-soft">
                      slug: {selectedNovel.slug}
                    </p>
                    <p className="mt-1 text-sm text-soft">
                      章节数：{selectedNovel.chapters.length}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/works/novels/${selectedNovel.slug}`}
                      className="admin-button-secondary px-4 py-2 text-sm"
                    >
                      查看前台
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDeleteNovel(selectedNovel)}
                      disabled={submitting}
                      className="admin-button-danger px-4 py-2 text-sm disabled:opacity-50"
                    >
                      删除小说
                    </button>
                  </div>
                </div>

                <label className="block">
                  <span className="text-sm text-muted">作者归属</span>
                  <select
                    value={selectedNovel.owner?.username ?? ""}
                    onChange={(event) =>
                      handleSetOwner(selectedNovel, event.target.value)
                    }
                    disabled={submitting}
                    className="admin-select mt-1 w-full px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="">未设置</option>
                    {ownerCandidates.map((owner) => (
                      <option key={owner.id} value={owner.username}>
                        {owner.displayName}（{owner.username} / {owner.role}）
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </section>
        </section>

        {selectedNovel && (
          <>
            <section className="admin-section">
              <h2 className="text-xl font-semibold text-main">创建章节</h2>

              <form
                onSubmit={handleCreateChapter}
                className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
              >
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm text-muted">章节 slug</span>
                    <input
                      value={newChapterSlug}
                      onChange={(event) =>
                        setNewChapterSlug(event.target.value)
                      }
                      className="admin-input mt-1 w-full px-3 py-2 text-sm"
                      placeholder="例如：chapter-001"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm text-muted">标题后缀，可空</span>
                    <input
                      value={newChapterTitle}
                      onChange={(event) =>
                        setNewChapterTitle(event.target.value)
                      }
                      className="admin-input mt-1 w-full px-3 py-2 text-sm"
                      placeholder="例如：起源"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="admin-button-primary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    创建章节
                  </button>
                </div>

                <label className="block">
                  <span className="text-sm text-muted">初始正文，可空</span>
                  <textarea
                    value={newChapterContent}
                    onChange={(event) =>
                      setNewChapterContent(event.target.value)
                    }
                    className="admin-textarea mt-1 min-h-[150px] w-full px-3 py-2 text-sm"
                    placeholder="仅在创建章节时写入。后续正文编辑放到作者侧。"
                  />
                </label>
              </form>
            </section>

            <section className="admin-section">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-main">章节管理</h2>
                  <p className="mt-1 text-sm text-soft">
                    调整标题后缀、上下移动、删除章节。不会读取或显示正文。
                  </p>
                </div>

                {selectedChapter && (
                  <Link
                    to={`/works/novels/${selectedNovel.slug}/${selectedChapter.slug}`}
                    className="admin-button-secondary px-4 py-2 text-sm"
                  >
                    查看当前章节
                  </Link>
                )}
              </div>

              {selectedNovel.chapters.length === 0 && (
                <p className="mt-4 text-sm text-soft">这部小说暂无章节。</p>
              )}

              {selectedNovel.chapters.length > 0 && (
                <div className="mt-5 space-y-3">
                  {selectedNovel.chapters.map((chapter) => {
                    const isSelected = chapter.slug === selectedChapterSlug;

                    return (
                      <article
                        key={chapter.id}
                        onClick={() => setSelectedChapterSlug(chapter.slug)}
                        className={
                          isSelected
                            ? "admin-muted-panel border-[var(--color-accent-border-strong)] px-4 py-4 shadow-sm"
                            : "admin-muted-panel px-4 py-4 hover:border-[var(--color-accent-border-strong)]"
                        }
                      >
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2 text-lg text-main">
                              <span className="text-muted">
                                {chapter.displayOrder}.
                              </span>

                              <InlineChapterTitleEditor
                                chapter={chapter}
                                disabled={submitting}
                                onSave={(value) =>
                                  handleRenameChapter(
                                    selectedNovel,
                                    chapter,
                                    value,
                                  )
                                }
                              />
                            </div>

                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
                              <span>{chapter.slug}</span>
                              <span>
                                更新于 {formatChinaDateTimeToMinute(chapter.updatedAt)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMoveChapter(selectedNovel, chapter, "up");
                              }}
                              disabled={submitting}
                              className="admin-button-secondary h-8 w-8 disabled:opacity-50"
                              title="上移"
                            >
                              ↿
                            </button>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMoveChapter(
                                  selectedNovel,
                                  chapter,
                                  "down",
                                );
                              }}
                              disabled={submitting}
                              className="admin-button-secondary h-8 w-8 disabled:opacity-50"
                              title="下移"
                            >
                              ⇂
                            </button>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteChapter(selectedNovel, chapter);
                              }}
                              disabled={submitting}
                              className="admin-button-danger px-4 py-2 text-sm disabled:opacity-50"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
