import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  getNovelDetail,
  getNovelReaderData,
  type NovelDetail,
  type NovelReaderData,
} from "../api/novels";
import CommentPanel from "../components/CommentPanel.tsx";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function getSavedScrollY(storageKey: string) {
  const savedValue = localStorage.getItem(storageKey);
  const savedScrollY = savedValue ? Number(savedValue) : 0;

  return Number.isFinite(savedScrollY) ? savedScrollY : 0;
}

function normalizePathname(value: string) {
  return value.replace(/\/+$/, "");
}

function NovelReaderPage() {
  const { novelSlug, chapterSlug } = useParams<{
    novelSlug: string;
    chapterSlug: string;
  }>();

  const [readerData, setReaderData] = useState<NovelReaderData | null>(null);
  const [novelDetail, setNovelDetail] = useState<NovelDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openChapterGroups, setOpenChapterGroups] = useState<
    Record<number, boolean>
  >({});

  const hasRestoredScrollRef = useRef(false);
  const isRestoringScrollRef = useRef(false);
  const latestScrollYRef = useRef(0);

  const scrollStorageKey = useMemo(() => {
    if (!novelSlug || !chapterSlug) return null;

    return `novel-reader-scroll:${novelSlug}:${chapterSlug}`;
  }, [novelSlug, chapterSlug]);

  const readerPathname = useMemo(() => {
    if (!novelSlug || !chapterSlug) return null;

    return normalizePathname(`/works/novels/${novelSlug}/${chapterSlug}`);
  }, [novelSlug, chapterSlug]);

  useEffect(() => {
    async function loadReaderData() {
      if (!novelSlug || !chapterSlug) {
        setErrorMessage("缺少小说或章节 slug。");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [readerResult, detailResult] = await Promise.all([
          getNovelReaderData(novelSlug, chapterSlug),
          getNovelDetail(novelSlug),
        ]);

        setReaderData(readerResult);
        setNovelDetail(detailResult);
      } catch (error) {
        console.error(error);

        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("章节内容加载失败。");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadReaderData();
  }, [novelSlug, chapterSlug]);

  useEffect(() => {
    hasRestoredScrollRef.current = false;
    isRestoringScrollRef.current = false;

    if (scrollStorageKey) {
      latestScrollYRef.current = getSavedScrollY(scrollStorageKey);
    } else {
      latestScrollYRef.current = 0;
    }
  }, [scrollStorageKey]);

  useLayoutEffect(() => {
    if (
      isLoading ||
      errorMessage ||
      !readerData ||
      !scrollStorageKey ||
      hasRestoredScrollRef.current
    ) {
      return;
    }

    hasRestoredScrollRef.current = true;
    isRestoringScrollRef.current = true;

    const safeScrollY = getSavedScrollY(scrollStorageKey);
    latestScrollYRef.current = safeScrollY;

    const restoreScroll = () => {
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;

      root.style.scrollBehavior = "auto";
      window.scrollTo(0, safeScrollY);
      root.style.scrollBehavior = previousScrollBehavior;

      latestScrollYRef.current = safeScrollY;
    };

    restoreScroll();

    const frameIds: number[] = [];

    frameIds.push(
      window.requestAnimationFrame(() => {
        frameIds.push(
          window.requestAnimationFrame(() => {
            restoreScroll();
            isRestoringScrollRef.current = false;
          }),
        );
      }),
    );

    return () => {
      frameIds.forEach((frameId) => {
        window.cancelAnimationFrame(frameId);
      });

      isRestoringScrollRef.current = false;
    };
  }, [isLoading, errorMessage, readerData, scrollStorageKey]);

  useEffect(() => {
    if (
      isLoading ||
      errorMessage ||
      !readerData ||
      !scrollStorageKey ||
      !readerPathname
    ) {
      return;
    }

    const storageKey = scrollStorageKey;
    const expectedPathname = readerPathname;

    latestScrollYRef.current = getSavedScrollY(storageKey);

    function isStillCurrentReaderPage() {
      return normalizePathname(window.location.pathname) === expectedPathname;
    }

    function saveScrollPosition(scrollY: number) {
      if (isRestoringScrollRef.current) return;
      if (!isStillCurrentReaderPage()) return;
      if (!Number.isFinite(scrollY)) return;

      latestScrollYRef.current = scrollY;
      localStorage.setItem(storageKey, String(scrollY));
    }

    function handleScroll() {
      saveScrollPosition(window.scrollY);
    }

    function handlePageHide() {
      saveScrollPosition(window.scrollY);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        saveScrollPosition(window.scrollY);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoading, errorMessage, readerData, scrollStorageKey, readerPathname]);

  const chapters = useMemo(() => {
    if (!novelDetail) return [];

    return [...novelDetail.chapters].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
  }, [novelDetail]);

  const chapterGroups = useMemo(() => {
    const groups = [];

    for (let index = 0; index < chapters.length; index += 10) {
      groups.push({
        groupIndex: Math.floor(index / 10),
        startOrder: chapters[index]?.displayOrder ?? index + 1,
        endOrder:
          chapters[Math.min(index + 9, chapters.length - 1)]?.displayOrder ??
          index + 10,
        chapters: chapters.slice(index, index + 10),
      });
    }

    return groups;
  }, [chapters]);

  useEffect(() => {
    if (chapters.length === 0) return;

    const currentIndex = chapters.findIndex(
      (chapter) => chapter.slug === chapterSlug,
    );

    const currentGroupIndex =
      currentIndex >= 0 ? Math.floor(currentIndex / 10) : 0;

    setOpenChapterGroups((previous) => {
      if (previous[currentGroupIndex]) return previous;

      return {
        ...previous,
        [currentGroupIndex]: true,
      };
    });
  }, [chapters, chapterSlug]);

  const currentChapterIndex = chapters.findIndex(
    (chapter) => chapter.slug === chapterSlug,
  );

  const previousChapter =
    currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;

  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
      ? chapters[currentChapterIndex + 1]
      : null;

  function toggleChapterGroup(groupIndex: number) {
    setOpenChapterGroups((previous) => ({
      ...previous,
      [groupIndex]: !previous[groupIndex],
    }));
  }

  return (
    <main className="page-shell min-h-[100dvh] pb-14">
      <section className="mx-auto max-w-[1250px] px-0 py-6 md:px-8 md:py-8">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <Link to="/works/novels" className="font-semibold link-accent">
            ← 小说存档
          </Link>

          {readerData && (
            <>
              <span className="text-soft">/</span>
              <Link
                to={`/works/novels/${readerData.novel.slug}`}
                className="font-semibold link-accent"
              >
                {readerData.novel.title}
              </Link>
            </>
          )}
        </div>

        {isLoading && (
          <section className="border-y border-[var(--color-border-soft)] px-6 py-8 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:shadow-[var(--shadow-card)]">
            <p className="text-sm text-soft">正在加载章节内容...</p>
          </section>
        )}

        {errorMessage && (
          <section>
            <p className="message-error p-4 text-sm">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && readerData && (
           <div className="novel-reader-frame relative z-10 border-y border-[var(--color-border-soft)] md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:shadow-[var(--shadow-card)]">
            <header className="novel-reader-header">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] link-accent">
                {readerData.novel.title}
              </p>

              <h1 className="mt-3 text-3xl font-bold leading-tight text-main md:text-4xl">
                {readerData.chapter.title}
              </h1>

              <p className="mt-4 text-sm text-soft">
                第 {readerData.chapter.displayOrder} 章 · 更新于{" "}
                {formatDate(readerData.chapter.updatedAt)}
              </p>
            </header>

            <article className="novel-reader-content">
              <div className="novel-markdown novel-reader-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {readerData.chapter.content || "本章暂无正文。"}
                </ReactMarkdown>
              </div>
            </article>

            <aside className="novel-reader-sidebar">
              <div className="novel-reader-toc">
                <p className="novel-reader-toc-title text-sm font-semibold text-main">
                  目录
                </p>

                <div className="novel-reader-toc-list mt-4 space-y-2">
                  {chapters.length <= 10
                    ? chapters.map((chapter) => {
                        const isCurrent = chapter.slug === chapterSlug;

                        return (
                          <Link
                            key={chapter.id}
                            to={`/works/novels/${readerData.novel.slug}/${chapter.slug}`}
                            className={[
                              "novel-toc-link",
                              isCurrent ? "novel-toc-link-active" : "",
                            ].join(" ")}
                          >
                            {chapter.title}
                          </Link>
                        );
                      })
                    : chapterGroups.map((group) => {
                        const isOpen =
                          openChapterGroups[group.groupIndex] ?? false;

                        return (
                          <div
                            key={group.groupIndex}
                            className="border-b border-[var(--color-border-soft)] pb-2 last:border-b-0"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                toggleChapterGroup(group.groupIndex)
                              }
                              className="flex w-full items-center justify-between px-1 py-1.5 text-left text-sm font-semibold text-main"
                            >
                              <span>
                                第 {group.startOrder}–{group.endOrder} 章
                              </span>
                              <span className="text-xs text-soft">
                                {isOpen ? "收起" : "展开"}
                              </span>
                            </button>

                            {isOpen && (
                              <div className="mt-1 space-y-0.5 pl-2">
                                {group.chapters.map((chapter) => {
                                  const isCurrent =
                                    chapter.slug === chapterSlug;

                                  return (
                                    <Link
                                      key={chapter.id}
                                      to={`/works/novels/${readerData.novel.slug}/${chapter.slug}`}
                                      className={[
                                        "novel-toc-link",
                                        isCurrent
                                          ? "novel-toc-link-active"
                                          : "",
                                      ].join(" ")}
                                    >
                                      {chapter.title}
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                </div>

                <div className="novel-reader-toc-footer">
                  <Link
                    to={`/works/novels/${readerData.novel.slug}`}
                    className="text-sm font-semibold link-accent"
                  >
                    返回详情页
                  </Link>
                </div>
              </div>
            </aside>

            <footer className="novel-reader-footer">
              {previousChapter ? (
                <Link
                  to={`/works/novels/${readerData.novel.slug}/${previousChapter.slug}`}
                  className="novel-reader-nav-card"
                >
                  <p className="text-xs text-soft">上一章</p>
                  <p className="truncate text-sm font-semibold text-main">
                    {previousChapter.title}
                  </p>
                </Link>
              ) : (
                <div className="novel-reader-nav-card opacity-60">
                  <p className="text-xs text-soft">上一章</p>
                  <p className="text-sm font-semibold text-main">
                    已经是第一章
                  </p>
                </div>
              )}

              {nextChapter ? (
                <Link
                  to={`/works/novels/${readerData.novel.slug}/${nextChapter.slug}`}
                  className="novel-reader-nav-card text-right"
                >
                  <p className="text-xs text-soft">下一章</p>
                  <p className="truncate text-sm font-semibold text-main">
                    {nextChapter.title}
                  </p>
                </Link>
              ) : (
                <div className="novel-reader-nav-card text-right opacity-60">
                  <p className="text-xs text-soft">下一章</p>
                  <p className="text-sm font-semibold text-main">
                    已经是最后一章
                  </p>
                </div>
              )}
            </footer>
          </div>
        )}
        {!isLoading && !errorMessage && readerData && (
          <section className="mt-8 border-y border-[var(--color-border-soft)] bg-[var(--color-panel-bg)] px-6 py-8 md:rounded-[var(--radius-card)] md:border md:px-10 md:shadow-[var(--shadow-card)]">
            <CommentPanel
              targetType="novel_chapter"
              targetId={readerData.chapter.id}
              title="章节小评"
              emptyText="还没有评论。"
            />
          </section>
        )}
      </section>
    </main>
  );
}

export default NovelReaderPage;