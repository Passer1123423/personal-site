import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getMe } from "../api/auth";
import {
  createAuthorNovelBuffer,
  deleteAuthorNovelBuffer,
  fetchAuthorNovelBuffers,
  fetchAuthorNovelsTree,
  loadAuthorChapterToBuffer,
  publishAuthorBufferToExistingChapter,
  publishAuthorBufferToNewChapter,
  renameAuthorNovelChapter,
  updateAuthorNovelBuffer,
  type AuthorNovel,
  type AuthorNovelBuffer,
  type AuthorNovelChapter,
} from "../api/authorNovels";

type ContentMode = "markdown" | "plain_text";

type Message = {
  type: "success" | "error";
  text: string;
};

type ChapterGroup = {
  groupIndex: number;
  startOrder: number;
  endOrder: number;
  chapters: AuthorNovelChapter[];
};

function getChapterCustomTitle(chapter: AuthorNovelChapter | null) {
  if (!chapter) {
    return "";
  }

  const pattern = new RegExp(`^第\\s*${chapter.displayOrder}\\s*章\\s*`);
  return chapter.title.replace(pattern, "").trim();
}

function makeNextChapterSlug(chapters: AuthorNovelChapter[]) {
  const usedNumbers = chapters
    .map((chapter) => {
      const match = chapter.slug.match(/^chapter-(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => value > 0);

  const nextNumber =
    usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;

  return `chapter-${String(nextNumber).padStart(3, "0")}`;
}

function sortChapters(chapters: AuthorNovelChapter[]) {
  return [...chapters].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
}

function makeChapterGroups(chapters: AuthorNovelChapter[]) {
  const groups: ChapterGroup[] = [];

  for (let index = 0; index < chapters.length; index += 10) {
    const groupChapters = chapters.slice(index, index + 10);

    groups.push({
      groupIndex: Math.floor(index / 10),
      startOrder: groupChapters[0]?.displayOrder ?? index + 1,
      endOrder:
        groupChapters[groupChapters.length - 1]?.displayOrder ?? index + 10,
      chapters: groupChapters,
    });
  }

  return groups;
}

function DisabledHintButton({
  children,
  reason,
  className,
}: {
  children: React.ReactNode;
  reason: string;
  className: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={reason}
      className={`${className} cursor-not-allowed opacity-55`}
    >
      {children}
    </button>
  );
}

export default function CreatorNovelChapterEditorPage() {
  const { novelSlug, chapterSlug } = useParams<{
    novelSlug: string;
    chapterSlug?: string;
  }>();

  const navigate = useNavigate();
  const isNewChapter = !chapterSlug;

  const [novels, setNovels] = useState<AuthorNovel[]>([]);
  const [currentNovel, setCurrentNovel] = useState<AuthorNovel | null>(null);
  const [currentChapter, setCurrentChapter] =
    useState<AuthorNovelChapter | null>(null);

  const [buffer, setBuffer] = useState<AuthorNovelBuffer | null>(null);
  const [content, setContent] = useState("");
  const [contentMode, setContentMode] = useState<ContentMode>("markdown");

  const [chapterSlugDraft, setChapterSlugDraft] = useState("");
  const [chapterTitleDraft, setChapterTitleDraft] = useState("");

  const [novelSearchKeyword, setNovelSearchKeyword] = useState("");
  const [chapterSearchByNovel, setChapterSearchByNovel] = useState<
    Record<string, string>
  >({});

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [metaCollapsed, setMetaCollapsed] = useState(false);
  const [catalogCollapsed, setCatalogCollapsed] = useState(false);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  const [openNovelSlugs, setOpenNovelSlugs] = useState<Record<string, boolean>>(
    {},
  );
  const [openChapterGroups, setOpenChapterGroups] = useState<
    Record<string, boolean>
  >({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMessage(null);
    }, 3200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message]);

  const filteredNovels = useMemo(() => {
    const keyword = novelSearchKeyword.trim().toLowerCase();

    if (!keyword) {
      return novels;
    }

    return novels.filter((novel) => {
      return (
        novel.title.toLowerCase().includes(keyword) ||
        novel.slug.toLowerCase().includes(keyword)
      );
    });
  }, [novels, novelSearchKeyword]);

  function getChapterSearchKeyword(novel: AuthorNovel) {
    return chapterSearchByNovel[novel.slug] ?? "";
  }

  function getFilteredChapters(novel: AuthorNovel) {
    const keyword = getChapterSearchKeyword(novel).trim().toLowerCase();
    const chapters = sortChapters(novel.chapters);

    if (!keyword) {
      return chapters;
    }

    return chapters.filter((chapter) => {
      return (
        chapter.title.toLowerCase().includes(keyword) ||
        chapter.slug.toLowerCase().includes(keyword)
      );
    });
  }

  function isNovelOpen(novel: AuthorNovel) {
    return Boolean(openNovelSlugs[novel.slug]);
  }

  function isGroupOpen(novelSlugValue: string, groupIndex: number) {
    return Boolean(openChapterGroups[`${novelSlugValue}:${groupIndex}`]);
  }

  function toggleNovel(novelSlugValue: string) {
    setOpenNovelSlugs((previous) => ({
      ...previous,
      [novelSlugValue]: !previous[novelSlugValue],
    }));
  }

  function toggleChapterGroup(novelSlugValue: string, groupIndex: number) {
    const key = `${novelSlugValue}:${groupIndex}`;

    setOpenChapterGroups((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  }

  function setNovelChapterSearch(novelSlugValue: string, value: string) {
    setChapterSearchByNovel((previous) => ({
      ...previous,
      [novelSlugValue]: value,
    }));
  }

  async function loadEditorData() {
    if (!novelSlug) {
      setMessage({ type: "error", text: "缺少 novel slug。" });
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await getMe();

      const tree = await fetchAuthorNovelsTree();
      const novel = tree.find((item) => item.slug === novelSlug);

      if (!novel) {
        throw new Error("未找到属于你的 novel。");
      }

      const sorted = sortChapters(novel.chapters);
      const chapter = chapterSlug
        ? sorted.find((item) => item.slug === chapterSlug) ?? null
        : null;

      if (chapterSlug && !chapter) {
        throw new Error("未找到目标 chapter。");
      }

      setNovels(tree);
      setCurrentNovel(novel);
      setCurrentChapter(chapter);

      const defaultSlug = chapter?.slug ?? makeNextChapterSlug(sorted);
      setChapterSlugDraft(defaultSlug);
      setChapterTitleDraft(getChapterCustomTitle(chapter));

      setOpenNovelSlugs((previous) => ({
        ...previous,
        [novel.slug]: true,
      }));

      if (chapter) {
        const currentChapterIndex = sorted.findIndex(
          (item) => item.slug === chapter.slug,
        );

        const currentGroupIndex =
          currentChapterIndex >= 0 ? Math.floor(currentChapterIndex / 10) : 0;

        setOpenChapterGroups((previous) => ({
          ...previous,
          [`${novel.slug}:${currentGroupIndex}`]: true,
        }));
      }

      const buffers = await fetchAuthorNovelBuffers(novel.slug);

      let selectedBuffer: AuthorNovelBuffer | null = null;

      if (chapter) {
        selectedBuffer =
          buffers.find((item) => item.chapterId === chapter.id) ?? null;

        if (!selectedBuffer) {
          selectedBuffer = await loadAuthorChapterToBuffer({
            novelSlug: novel.slug,
            chapterSlug: chapter.slug,
          });
        }
      } else {
        selectedBuffer =
          buffers.find((item) => item.chapterId === null) ?? null;

        if (!selectedBuffer) {
          selectedBuffer = await createAuthorNovelBuffer({
            novelSlug: novel.slug,
            contentType: "markdown",
          });
        }
      }

      setBuffer(selectedBuffer);
      setContent(selectedBuffer.content);
      setContentMode(selectedBuffer.contentType);
      setDirty(false);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "加载编辑器失败",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEditorData();
  }, [novelSlug, chapterSlug]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirty]);

  async function saveBuffer() {
    if (!buffer) {
      return null;
    }

    const saved = await updateAuthorNovelBuffer({
      bufferId: buffer.id,
      content,
      contentType: isNewChapter ? contentMode : "markdown",
    });

    setBuffer(saved);
    setDirty(false);

    return saved;
  }

  async function prepareLeave() {
    if (!dirty) {
      return true;
    }

    const action = window.prompt(
      "当前缓冲区有未保存改动。\n\n输入 1：保存缓冲区并继续\n输入 2：删除缓冲区并继续\n输入其他或关闭：取消切换",
      "1",
    );

    try {
      if (action === "1") {
        await saveBuffer();
        return true;
      }

      if (action === "2") {
        setDirty(false);

        if (buffer) {
          deleteAuthorNovelBuffer(buffer.id).catch(() => {
            // 离开页面时删除缓冲区失败，不阻断跳转。
            // 下次进入时后端如果仍有旧 buffer，会重新加载。
          });
        }

        return true;
      }

      return false;
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "处理缓冲区失败",
      });

      return false;
    }
  }

  async function handleNavigate(path: string) {
    const ok = await prepareLeave();

    if (ok) {
      navigate(path);
    }
  }

  async function handleSaveBufferClick() {
    setSubmitting(true);
    setMessage(null);

    try {
      await saveBuffer();
      setMessage({ type: "success", text: "缓冲区已保存。" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存缓冲区失败",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish() {
    if (!currentNovel || !buffer) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const saved = await saveBuffer();

      if (!saved) {
        throw new Error("缓冲区不存在。");
      }

      if (isNewChapter) {
        const slug = chapterSlugDraft.trim();

        if (!slug) {
          throw new Error("新建 chapter 时 slug 不能为空。");
        }

        const chapter = await publishAuthorBufferToNewChapter({
          novelSlug: currentNovel.slug,
          bufferId: saved.id,
          slug,
          customTitle: chapterTitleDraft,
        });

        setMessage({ type: "success", text: "新章节已发布。" });
        navigate(`/creator/novels/${currentNovel.slug}/${chapter.slug}/edit`);
        return;
      }

      if (!currentChapter) {
        throw new Error("缺少目标 chapter。");
      }

      if (chapterTitleDraft.trim() !== getChapterCustomTitle(currentChapter)) {
        await renameAuthorNovelChapter({
          novelSlug: currentNovel.slug,
          chapterSlug: currentChapter.slug,
          customTitle: chapterTitleDraft,
        });
      }

      await publishAuthorBufferToExistingChapter({
        novelSlug: currentNovel.slug,
        chapterSlug: currentChapter.slug,
        bufferId: saved.id,
      });

      setBuffer(null);
      setDirty(false);
      setMessage({ type: "success", text: "章节正文已上传覆盖。" });
      await loadEditorData();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "发布失败",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClearBuffer() {
    const confirmed = window.confirm(
      "确定清除当前缓冲区吗？清除后未上传内容会丢失。",
    );

    if (!confirmed) {
      return;
    }

    if (!currentNovel) {
      setMessage({
        type: "error",
        text: "缺少当前 novel，无法清除缓冲区。",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      if (buffer) {
        await deleteAuthorNovelBuffer(buffer.id);
      }

      const newBuffer = await createAuthorNovelBuffer({
        novelSlug: currentNovel.slug,
        contentType: isNewChapter ? contentMode : "markdown",
      });

      setBuffer(newBuffer);
      setContent("");
      setDirty(false);

      setMessage({
        type: "success",
        text: "缓冲区已清除。",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "清除缓冲区失败",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-page-shell min-h-[100dvh] px-6 py-10">
        <p className="text-sm text-soft">正在加载编辑器...</p>
      </main>
    );
  }

  if (!currentNovel) {
    return (
      <main className="admin-page-shell min-h-[100dvh] px-6 py-10">
        <Link to="/creator/novels" className="link-accent text-sm">
          返回小说书架
        </Link>
        <p className="mt-6 text-sm text-muted">没有找到 novel。</p>
      </main>
    );
  }

  return (
    <main className="admin-page-shell h-[100dvh] overflow-hidden px-4 py-5">
      <div className="mx-auto grid h-full max-w-[1720px] grid-cols-[320px_minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <aside className="min-h-0">
          <section className="admin-section flex h-full min-h-0 flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-3 py-2">
              <button
                type="button"
                className="text-sm font-semibold link-accent"
                onClick={() => setSidebarCollapsed((value) => !value)}
              >
                {sidebarCollapsed ? "展开目录栏" : "折叠目录栏"}
              </button>

              <Link
                to={`/creator/novels/${currentNovel.slug}`}
                className="text-xs link-accent"
                onClick={(event) => {
                  event.preventDefault();
                  handleNavigate(`/creator/novels/${currentNovel.slug}`);
                }}
              >
                返回管理
              </Link>
            </div>

            {sidebarCollapsed ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-3 text-center text-xs leading-6 text-soft">
                目录栏已折叠
              </div>
            ) : (
              <>
                <div className="border-b border-[var(--color-border-soft)] px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">
                      Chapter Info
                    </p>

                    <button
                      type="button"
                      className="text-xs link-accent"
                      onClick={() => setMetaCollapsed((value) => !value)}
                    >
                      {metaCollapsed ? "展开" : "折叠"}
                    </button>
                  </div>

                  {!metaCollapsed && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-main">
                          Chapter slug
                        </label>

                        {isNewChapter ? (
                          <input
                            className="admin-input mt-1 w-full px-3 py-2 text-sm"
                            value={chapterSlugDraft}
                            disabled={submitting}
                            onChange={(event) => {
                              setChapterSlugDraft(event.target.value);
                              setDirty(true);
                            }}
                            placeholder="例如：chapter-001"
                          />
                        ) : (
                          <input
                            className="admin-input mt-1 w-full cursor-not-allowed px-3 py-2 text-sm opacity-60"
                            value={chapterSlugDraft}
                            disabled
                            title="已有 chapter 的 slug 不能在编辑页修改。"
                          />
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-main">
                          标题后缀
                        </label>

                        <input
                          className="admin-input mt-1 w-full px-3 py-2 text-sm"
                          value={chapterTitleDraft}
                          disabled={submitting}
                          onChange={(event) => {
                            setChapterTitleDraft(event.target.value);
                            setDirty(true);
                          }}
                          placeholder="例如：起源"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">
                    Catalog
                  </p>

                  <button
                    type="button"
                    className="text-xs link-accent"
                    onClick={() => setCatalogCollapsed((value) => !value)}
                  >
                    {catalogCollapsed ? "展开" : "折叠"}
                  </button>
                </div>

                {catalogCollapsed ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center px-3 text-center text-xs leading-6 text-soft">
                    章节目录已折叠
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                    <input
                      className="admin-input mb-3 w-full border-transparent bg-[var(--color-panel-soft-bg)] px-3 py-2 text-xs"
                      value={novelSearchKeyword}
                      onChange={(event) =>
                        setNovelSearchKeyword(event.target.value)
                      }
                      placeholder="搜索 novel"
                    />

                    <div className="space-y-3">
                      {filteredNovels.map((novel) => {
                        const open = isNovelOpen(novel);
                        const chapterKeyword = getChapterSearchKeyword(novel);
                        const filteredChapters = getFilteredChapters(novel);
                        const chapterGroups = makeChapterGroups(filteredChapters);
                        const selectedNovel = novel.slug === currentNovel.slug;

                        return (
                          <section
                            key={novel.id}
                            className={
                              selectedNovel
                                ? "rounded-xl border border-[var(--color-accent-border-strong)] bg-white/80"
                                : "rounded-xl border border-[var(--color-border-soft)] bg-white/60"
                            }
                          >
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                              onClick={() => toggleNovel(novel.slug)}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-main">
                                  {novel.title}
                                </span>

                                <span className="block truncate text-[11px] text-soft">
                                  {novel.slug}
                                </span>
                              </span>

                              <span className="shrink-0 text-xs text-soft">
                                {open ? "收起" : "展开"}
                              </span>
                            </button>

                            {open && (
                              <div className="border-t border-[var(--color-border-soft)] px-3 pb-3 pt-2">
                                <input
                                  className="admin-input mb-2 w-full border-transparent bg-[var(--color-panel-soft-bg)] px-2 py-1.5 text-xs"
                                  value={chapterKeyword}
                                  onChange={(event) =>
                                    setNovelChapterSearch(
                                      novel.slug,
                                      event.target.value,
                                    )
                                  }
                                  placeholder="搜索 chapter"
                                />

                                {chapterGroups.length === 0 ? (
                                  <p className="border-l border-[var(--color-border-soft)] py-2 pl-3 text-xs text-soft">
                                    暂无匹配 chapter。
                                  </p>
                                ) : (
                                  <div className="space-y-2 border-l border-[var(--color-border-soft)] pl-3">
                                    {chapterGroups.map((group) => {
                                      const groupOpen = isGroupOpen(
                                        novel.slug,
                                        group.groupIndex,
                                      );

                                      return (
                                        <div key={group.groupIndex}>
                                          <button
                                            type="button"
                                            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs text-muted hover:bg-[var(--color-panel-soft-bg)]"
                                            onClick={() =>
                                              toggleChapterGroup(
                                                novel.slug,
                                                group.groupIndex,
                                              )
                                            }
                                          >
                                            <span>
                                              第{group.startOrder}-
                                              {group.endOrder}章
                                            </span>

                                            <span>
                                              {groupOpen ? "收起" : "展开"}
                                            </span>
                                          </button>

                                          {groupOpen && (
                                            <div className="mt-1 space-y-1">
                                              {group.chapters.map((chapter) => {
                                                const selected =
                                                  novel.slug ===
                                                    currentNovel.slug &&
                                                  chapter.slug === chapterSlug;

                                                return (
                                                  <button
                                                    type="button"
                                                    key={chapter.id}
                                                    className={
                                                      selected
                                                        ? "w-full rounded-md border-l-2 border-[var(--color-accent)] bg-[var(--color-panel-soft-bg)] px-2 py-1.5 text-left text-xs font-semibold text-main"
                                                        : "w-full rounded-md border-l-2 border-transparent px-2 py-1.5 text-left text-xs text-muted hover:bg-[var(--color-panel-soft-bg)] hover:text-main"
                                                    }
                                                    onClick={() =>
                                                      handleNavigate(
                                                        `/creator/novels/${novel.slug}/${chapter.slug}/edit`,
                                                      )
                                                    }
                                                  >
                                                    <span className="block truncate">
                                                      {chapter.title}
                                                    </span>

                                                    <span className="block truncate text-[10px] text-soft">
                                                      {chapter.slug}
                                                    </span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                <button
                                  type="button"
                                  className={
                                    novel.slug === currentNovel.slug &&
                                    isNewChapter
                                      ? "mt-2 w-full rounded-md border-l-2 border-[var(--color-accent)] bg-[var(--color-panel-soft-bg)] px-2 py-2 text-left text-xs font-semibold link-accent"
                                      : "mt-2 w-full rounded-md border-l-2 border-transparent px-2 py-2 text-left text-xs link-accent hover:bg-[var(--color-panel-soft-bg)]"
                                  }
                                  onClick={() =>
                                    handleNavigate(
                                      `/creator/novels/${novel.slug}/new-chapter`,
                                    )
                                  }
                                >
                                  ＋ 新建章节...
                                </button>
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </aside>

        <section className="min-h-0 min-w-0">
          <section className="admin-section flex h-full min-h-0 flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-main">
                  {isNewChapter ? "新建 chapter" : currentChapter?.title}
                </h1>

                <p className="mt-1 truncate text-xs text-soft">
                  {currentNovel.title} / {chapterSlugDraft}
                </p>
              </div>

              <button
                type="button"
                className="admin-button-secondary px-3 py-2 text-xs font-semibold"
                onClick={() => setEditorCollapsed((value) => !value)}
              >
                {editorCollapsed ? "展开编辑区" : "折叠编辑区"}
              </button>
            </div>

            {message && (
              <div
                className={
                  message.type === "success"
                    ? "admin-message-success mx-4 mt-4 px-4 py-3"
                    : "admin-message-error mx-4 mt-4 px-4 py-3"
                }
              >
                {message.text}
              </div>
            )}

            {editorCollapsed ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-soft">
                编辑区已折叠
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
                  <div className="flex rounded-lg border border-[var(--color-border-soft)] bg-white p-1 text-xs">
                    <button
                      type="button"
                      className={
                        contentMode === "markdown"
                          ? "rounded-md bg-[var(--color-panel-soft-bg)] px-3 py-1 font-semibold text-main"
                          : "rounded-md px-3 py-1 text-soft"
                      }
                      disabled={submitting}
                      onClick={() => {
                        setContentMode("markdown");
                        setDirty(true);
                      }}
                    >
                      Markdown
                    </button>

                    {isNewChapter ? (
                      <button
                        type="button"
                        className={
                          contentMode === "plain_text"
                            ? "rounded-md bg-[var(--color-panel-soft-bg)] px-3 py-1 font-semibold text-main"
                            : "rounded-md px-3 py-1 text-soft"
                        }
                        disabled={submitting}
                        onClick={() => {
                          setContentMode("plain_text");
                          setDirty(true);
                        }}
                      >
                        文本
                      </button>
                    ) : (
                      <DisabledHintButton
                        reason="编辑已有 chapter 时只支持 Markdown。"
                        className="rounded-md px-3 py-1 text-soft"
                      >
                        文本
                      </DisabledHintButton>
                    )}
                  </div>

                  <button
                    type="button"
                    className="admin-button-secondary px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={submitting || !dirty}
                    title={!dirty ? "当前没有需要保存的缓冲区改动。" : ""}
                    onClick={handleSaveBufferClick}
                  >
                    保存缓冲区
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden px-4 py-4">
                  <textarea
                    className="admin-textarea h-full w-full resize-none px-4 py-4 font-mono text-sm leading-7"
                    value={content}
                    disabled={submitting}
                    onChange={(event) => {
                      setContent(event.target.value);
                      setDirty(true);
                    }}
                    placeholder={
                      contentMode === "markdown"
                        ? "在这里编写 Markdown 正文..."
                        : "在这里输入普通文本，上传时会转成 Markdown..."
                    }
                  />
                </div>
              </>
            )}
          </section>
        </section>

        <section className="min-h-0 min-w-0">
          <section className="admin-section flex h-full min-h-0 flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-main">实时预览</h2>
                <p className="mt-1 text-xs text-soft">
                  预览以 Markdown 渲染为准。
                </p>
              </div>

              <button
                type="button"
                className="admin-button-secondary px-3 py-2 text-xs font-semibold"
                onClick={() => setPreviewCollapsed((value) => !value)}
              >
                {previewCollapsed ? "展开预览区" : "折叠预览区"}
              </button>
            </div>

            {previewCollapsed ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-soft">
                预览区已折叠
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                  <article className="novel-preview-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content || "暂无内容。"}
                    </ReactMarkdown>
                  </article>
                </div>

                <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border-soft)] px-4 py-3">
                  <button
                    type="button"
                    className="admin-button-danger px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={submitting || !buffer}
                    title={!buffer ? "当前没有可清除的缓冲区。" : ""}
                    onClick={handleClearBuffer}
                  >
                    清除缓冲区
                  </button>

                  <button
                    type="button"
                    className="admin-button-primary px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={submitting || !buffer}
                    title={!buffer ? "当前没有可上传的缓冲区。" : ""}
                    onClick={handlePublish}
                  >
                    {isNewChapter ? "上传为新 chapter" : "上传覆盖 chapter"}
                  </button>
                </div>
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}