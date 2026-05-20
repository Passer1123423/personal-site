import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getComicReaderData,
  getComicSeriesDetail,
  resolveAssetUrl,
  type ComicChapterItem,
  type ComicReaderData,
  type ComicSeriesDetail,
} from "../api/comics";

type ChapterNavItem = {
  slug: string;
  title: string;
} | null;

const readerStyle = {
  page: {
    backgroundColor: "var(--color-reader-bg, #475569)",
    color: "var(--color-reader-text-main, #f8fafc)",
  },
  header: {
    backgroundColor: "var(--color-reader-header-bg, rgba(51, 65, 85, 0.88))",
    borderColor: "var(--color-reader-border, rgba(255, 255, 255, 0.16))",
  },
  panel: {
    backgroundColor: "var(--color-reader-panel-bg, rgba(30, 41, 59, 0.62))",
    borderColor: "var(--color-reader-border, rgba(255, 255, 255, 0.16))",
  },
  panelStrong: {
    backgroundColor:
      "var(--color-reader-panel-strong-bg, rgba(15, 23, 42, 0.55))",
    borderColor: "var(--color-reader-border, rgba(255, 255, 255, 0.16))",
  },
  textMain: {
    color: "var(--color-reader-text-main, #f8fafc)",
  },
  textMuted: {
    color: "var(--color-reader-text-muted, #cbd5e1)",
  },
  textSoft: {
    color: "var(--color-reader-text-soft, #94a3b8)",
  },
} satisfies Record<string, CSSProperties>;

function ComicPageImage({
  src,
  displayOrder,
}: {
  src: string;
  displayOrder: number;
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (hasError) {
    return (
      <div
        className="mx-auto flex min-h-72 w-full max-w-[920px] items-center justify-center border px-6 py-10 text-center text-sm"
        style={{ ...readerStyle.panelStrong, ...readerStyle.textSoft }}
      >
        第 {displayOrder} 页图片加载失败
      </div>
    );
  }

  return (
    <figure className="mx-auto w-full max-w-[920px]">
      {!isLoaded && (
        <div
          className="mb-3 flex min-h-72 items-center justify-center text-sm"
          style={{ ...readerStyle.panelStrong, ...readerStyle.textSoft }}
        >
          正在加载第 {displayOrder} 页...
        </div>
      )}

      <img
        src={src}
        alt={`第 ${displayOrder} 页`}
        className={`w-full bg-white shadow-[0_18px_48px_rgba(15,23,42,0.35)] transition ${
          isLoaded ? "block" : "hidden"
        }`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </figure>
  );
}

function findChapterNavItems(
  series: ComicSeriesDetail | null,
  partSlug: string | undefined,
  chapterSlug: string | undefined,
): {
  previousChapter: ChapterNavItem;
  nextChapter: ChapterNavItem;
} {
  if (!series || !partSlug || !chapterSlug) {
    return {
      previousChapter: null,
      nextChapter: null,
    };
  }

  const part = series.parts.find((item) => item.slug === partSlug);

  if (!part) {
    return {
      previousChapter: null,
      nextChapter: null,
    };
  }

  const chapters = [...part.chapters].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  const currentIndex = chapters.findIndex((item) => item.slug === chapterSlug);

  if (currentIndex < 0) {
    return {
      previousChapter: null,
      nextChapter: null,
    };
  }

  function toNavItem(chapter: ComicChapterItem | undefined): ChapterNavItem {
    if (!chapter) {
      return null;
    }

    return {
      slug: chapter.slug,
      title: chapter.title,
    };
  }

  return {
    previousChapter: toNavItem(chapters[currentIndex - 1]),
    nextChapter: toNavItem(chapters[currentIndex + 1]),
  };
}

function ComicReaderPage() {
  const { seriesSlug, partSlug, chapterSlug } = useParams();

  const [readerData, setReaderData] = useState<ComicReaderData | null>(null);
  const [seriesDetail, setSeriesDetail] = useState<ComicSeriesDetail | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadReaderData() {
      if (!seriesSlug || !partSlug || !chapterSlug) {
        setErrorMessage("缺少漫画阅读参数。");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [reader, series] = await Promise.all([
          getComicReaderData(seriesSlug, partSlug, chapterSlug),
          getComicSeriesDetail(seriesSlug),
        ]);

        setReaderData(reader);
        setSeriesDetail(series);
      } catch (error) {
        console.error(error);

        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("漫画章节加载失败，请确认后端服务是否正在运行。");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadReaderData();
  }, [seriesSlug, partSlug, chapterSlug]);

  const { previousChapter, nextChapter } = useMemo(
    () => findChapterNavItems(seriesDetail, partSlug, chapterSlug),
    [seriesDetail, partSlug, chapterSlug],
  );

  const seriesHref = readerData
    ? `/works/comics/${readerData.series.slug}`
    : "/works/comics";

  const previousHref =
    readerData && previousChapter
      ? `/works/comics/${readerData.series.slug}/${readerData.part.slug}/${previousChapter.slug}`
      : null;

  const nextHref =
    readerData && nextChapter
      ? `/works/comics/${readerData.series.slug}/${readerData.part.slug}/${nextChapter.slug}`
      : null;

  const chapterSummary =
    readerData && "summary" in readerData.chapter
      ? (readerData.chapter as { summary?: string | null }).summary
      : null;

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (isLoading) {
    return (
      <main className="min-h-[100dvh] px-6 py-16" style={readerStyle.page}>
        <section className="mx-auto max-w-4xl">
          <p className="text-sm" style={readerStyle.textMuted}>
            正在加载漫画章节...
          </p>
        </section>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-[100dvh] px-6 py-16" style={readerStyle.page}>
        <section className="mx-auto max-w-4xl">
          <Link
            to="/works/comics"
            className="text-sm font-semibold transition hover:underline hover:underline-offset-4"
            style={{ color: "var(--color-accent-soft, #dbeafe)" }}
          >
            ← 返回漫画存档
          </Link>

          <p
            className="mt-8 border p-4 text-sm"
            style={{
              borderColor: "var(--color-danger-border, #fecaca)",
              backgroundColor: "var(--color-danger-bg, #fef2f2)",
              color: "var(--color-danger, #dc2626)",
            }}
          >
            {errorMessage}
          </p>
        </section>
      </main>
    );
  }

  if (!readerData) {
    return (
      <main className="min-h-[100dvh] px-6 py-16" style={readerStyle.page}>
        <section className="mx-auto max-w-4xl">
          <p className="text-sm" style={readerStyle.textMuted}>
            未找到漫画章节。
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh]" style={readerStyle.page}>
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={readerStyle.header}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link
            to={seriesHref}
            className="shrink-0 text-sm font-semibold transition hover:underline hover:underline-offset-4"
            style={readerStyle.textMuted}
          >
            ← 目录
          </Link>

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-xs" style={readerStyle.textSoft}>
              {readerData.series.title} / {readerData.part.title}
            </p>
            <h1
              className="truncate text-sm font-semibold md:text-base"
              style={readerStyle.textMain}
            >
              {readerData.chapter.title}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {previousHref ? (
              <Link
                to={previousHref}
                className="hidden border px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10 hover:underline hover:underline-offset-4 sm:inline-flex"
                style={{ ...readerStyle.panel, ...readerStyle.textMuted }}
              >
                上一话
              </Link>
            ) : (
              <span
                className="hidden border px-3 py-1.5 text-xs opacity-50 sm:inline-flex"
                style={{ ...readerStyle.panel, ...readerStyle.textSoft }}
              >
                上一话
              </span>
            )}

            {nextHref ? (
              <Link
                to={nextHref}
                className="border px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10 hover:underline hover:underline-offset-4"
                style={{ ...readerStyle.panelStrong, ...readerStyle.textMain }}
              >
                下一话
              </Link>
            ) : (
              <span
                className="border px-3 py-1.5 text-xs opacity-50"
                style={{ ...readerStyle.panel, ...readerStyle.textSoft }}
              >
                下一话
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6">
        <div className="mx-auto max-w-[920px] pb-8">
          <p
            className="text-xs font-semibold uppercase tracking-[0.28em]"
            style={{ color: "var(--color-accent-soft, #dbeafe)" }}
          >
            Comic Reader
          </p>

          <h2
            className="mt-3 text-2xl font-bold md:text-4xl"
            style={readerStyle.textMain}
          >
            {readerData.chapter.title}
          </h2>

          <p className="mt-4 text-sm leading-7" style={readerStyle.textMuted}>
            {readerData.series.title} / {readerData.part.title} / 共{" "}
            {readerData.pages.length} 页
          </p>

          {chapterSummary && (
            <p
              className="mt-4 border-l-2 pl-4 text-sm leading-7"
              style={{
                ...readerStyle.textMuted,
                borderColor: "var(--color-reader-border, rgba(255,255,255,.16))",
              }}
            >
              {chapterSummary}
            </p>
          )}
        </div>

        <div className="space-y-4 md:space-y-5">
          {readerData.pages.length > 0 ? (
            readerData.pages.map((page) => {
              const imageUrl = resolveAssetUrl(page.imageUrl);

              if (!imageUrl) {
                return (
                  <div
                    key={page.id}
                    className="mx-auto flex min-h-72 w-full max-w-[920px] items-center justify-center border px-6 py-10 text-center text-sm"
                    style={{ ...readerStyle.panelStrong, ...readerStyle.textSoft }}
                  >
                    第 {page.displayOrder} 页图片缺失
                  </div>
                );
              }

              return (
                <ComicPageImage
                  key={page.id}
                  src={imageUrl}
                  displayOrder={page.displayOrder}
                />
              );
            })
          ) : (
            <p
              className="mx-auto max-w-[920px] text-sm"
              style={readerStyle.textSoft}
            >
              这一章暂无页面。
            </p>
          )}
        </div>

        <div
          className="mx-auto mt-14 grid max-w-[920px] gap-3 border-t pt-6 sm:grid-cols-3"
          style={{ borderColor: "var(--color-reader-border, rgba(255,255,255,.16))" }}
        >
          {previousHref ? (
            <Link
              to={previousHref}
              className="border px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/10 hover:underline hover:underline-offset-4"
              style={{ ...readerStyle.panel, ...readerStyle.textMuted }}
            >
              ← {previousChapter?.title}
            </Link>
          ) : (
            <span
              className="border px-4 py-3 text-center text-sm opacity-50"
              style={{ ...readerStyle.panel, ...readerStyle.textSoft }}
            >
              已是第一话
            </span>
          )}

          <Link
            to={seriesHref}
            className="border px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/10 hover:underline hover:underline-offset-4"
            style={{ ...readerStyle.panelStrong, ...readerStyle.textMain }}
          >
            返回目录
          </Link>

          {nextHref ? (
            <Link
              to={nextHref}
              className="border px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/10 hover:underline hover:underline-offset-4"
              style={{ ...readerStyle.panel, ...readerStyle.textMuted }}
            >
              {nextChapter?.title} →
            </Link>
          ) : (
            <span
              className="border px-4 py-3 text-center text-sm opacity-50"
              style={{ ...readerStyle.panel, ...readerStyle.textSoft }}
            >
              已是最后一话
            </span>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 z-30 border px-4 py-3 text-sm font-semibold shadow-[0_12px_32px_rgba(15,23,42,0.26)] backdrop-blur transition hover:bg-white/10 hover:underline hover:underline-offset-4"
        style={{ ...readerStyle.panelStrong, ...readerStyle.textMain }}
      >
        ↑ 顶部
      </button>
    </main>
  );
}

export default ComicReaderPage;