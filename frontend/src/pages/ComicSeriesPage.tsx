import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  getComicSeriesDetail,
  resolveAssetUrl,
  type ComicChapterItem,
  type ComicPartItem,
  type ComicSeriesDetail,
} from "../api/comics";

function EmptyCover({ title }: { title: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 px-5 text-center">
      <div className="absolute inset-y-0 left-0 w-4 border-r border-black/20 bg-black/15" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-white/10" />
      <p className="relative text-base font-semibold leading-7 text-white">
        {title}
      </p>
    </div>
  );
}

function ChapterGridItem({
  seriesSlug,
  partSlug,
  chapter,
}: {
  seriesSlug: string;
  partSlug: string;
  chapter: ComicChapterItem;
}) {
  return (
    <Link
      to={`/works/comics/${seriesSlug}/${partSlug}/${chapter.slug}`}
      className="group min-w-0 rounded-lg border border-[var(--color-border-soft)] bg-white px-2.5 py-1.5 text-xs shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-accent-border-strong)] hover:bg-[var(--color-accent-soft)] hover:shadow-md"
    >
      <span className="block truncate font-medium text-main group-hover:underline group-hover:underline-offset-4">
        {chapter.title}
      </span>
    </Link>
  );
}

function PartSection({
  seriesSlug,
  part,
  initialOpen,
  partRef,
}: {
  seriesSlug: string;
  part: ComicPartItem;
  initialOpen: boolean;
  partRef: (node: HTMLElement | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const coverUrl = resolveAssetUrl(part.coverUrl);
  const sortedChapters = [...part.chapters].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  return (
    <article
      ref={partRef}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm"
    >
      <button
        type="button"
        className="group grid w-full min-h-44 text-left transition hover:bg-[var(--color-panel-soft-bg)] sm:grid-cols-[150px_minmax(0,1fr)] md:grid-cols-[170px_minmax(0,1fr)]"
        onClick={() => setIsOpen((value) => !value)}
      >
        <div className="hidden h-full min-h-44 overflow-hidden border-r border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] sm:block">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={part.title}
              className="h-full min-h-44 w-full object-cover"
            />
          ) : (
            <EmptyCover title={part.title} />
          )}
        </div>

        <div className="flex min-w-0 items-center justify-between gap-5 px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-main group-hover:underline group-hover:underline-offset-4">
              {part.title}
            </h2>

            {part.summary ? (
              <p className="mt-3 line-clamp-2 max-w-4xl text-sm leading-7 text-muted">
                {part.summary}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-7 text-soft">
                暂无分部简介。
              </p>
            )}
          </div>

          <span className="shrink-0 text-2xl font-light text-soft transition group-hover:text-muted">
            {isOpen ? "−" : "+"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] px-5 py-5">
          {sortedChapters.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {sortedChapters.map((chapter) => (
                <ChapterGridItem
                  key={chapter.id}
                  seriesSlug={seriesSlug}
                  partSlug={part.slug}
                  chapter={chapter}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--color-border-control)] bg-white px-4 py-5 text-center text-sm text-soft">
              暂无章节。
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ComicSeriesPage() {
  const { seriesSlug } = useParams();

  const [series, setSeries] = useState<ComicSeriesDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(true);

  const partRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    async function loadSeriesDetail() {
      if (!seriesSlug) {
        setErrorMessage("缺少漫画系列参数。");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const data = await getComicSeriesDetail(seriesSlug);
        setSeries(data);
      } catch (error) {
        console.error(error);

        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("漫画详情加载失败。");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadSeriesDetail();
  }, [seriesSlug]);

  const sortedParts = useMemo(() => {
    if (!series) {
      return [];
    }

    return [...series.parts].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [series]);

  function scrollToPart(partSlug: string) {
    const target = partRefs.current[partSlug];

    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  if (isLoading) {
    return (
      <main className="page-shell min-h-[100dvh] px-6 py-16">
        <section className="mx-auto max-w-6xl">
          <p className="text-sm text-soft">正在加载漫画详情...</p>
        </section>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="page-shell min-h-[100dvh] px-6 py-16">
        <section className="mx-auto max-w-6xl">
          <Link to="/works/comics" className="link-accent text-sm font-semibold">
            ← 返回漫画存档
          </Link>

          <p className="message-error mt-8 p-4 text-sm">{errorMessage}</p>
        </section>
      </main>
    );
  }

  if (!series) {
    return (
      <main className="page-shell min-h-[100dvh] px-6 py-16">
        <section className="mx-auto max-w-6xl">
          <p className="text-sm text-soft">未找到漫画系列。</p>
        </section>
      </main>
    );
  }

  const coverUrl = resolveAssetUrl(series.coverUrl);

  return (
    <main className="page-shell min-h-[100dvh] px-6 py-14">
      <section className="mx-auto max-w-7xl">
        <Link to="/works/comics" className="link-accent text-sm font-semibold">
          ← 返回漫画存档
        </Link>

        <section className="mt-8 overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="relative min-h-96 border-b border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] lg:border-b-0 lg:border-r">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={series.title}
                  className="h-full min-h-96 w-full object-cover"
                />
              ) : (
                <EmptyCover title={series.title} />
              )}
            </div>

            <div className="flex flex-col justify-between p-7 md:p-9">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                  Comic Series
                </p>

                <h1 className="mt-4 text-4xl font-bold leading-tight text-main">
                  {series.title}
                </h1>

                {series.summary ? (
                  <p className="mt-6 max-w-3xl text-base leading-8 text-muted">
                    {series.summary}
                  </p>
                ) : (
                  <p className="mt-6 max-w-3xl text-base leading-8 text-soft">
                    暂无系列简介。
                  </p>
                )}
              </div>

              <div className="mt-8 border-t border-[var(--color-border-soft)] pt-5">
                <p className="text-sm leading-7 text-soft">
                  选择下方分部展开目录，点击章节进入阅读。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
              Contents
            </p>

            <h2 className="mt-2 text-2xl font-bold text-main">分部目录</h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
              每个分部可以展开查看章节。左侧目录可以快速跳转到对应分部。
            </p>
          </div>

          {sortedParts.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="hidden lg:block">
                <div className="sticky top-24 overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3 text-left"
                    onClick={() => setTocOpen((value) => !value)}
                  >
                    <span className="text-sm font-semibold text-main">
                      目录导航
                    </span>
                    <span className="text-lg font-light text-soft">
                      {tocOpen ? "−" : "+"}
                    </span>
                  </button>

                  {tocOpen && (
                    <nav className="max-h-[calc(100dvh-9rem)] overflow-y-auto px-2 py-2">
                      {sortedParts.map((part, index) => (
                        <button
                          key={part.id}
                          type="button"
                          className="group flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[var(--color-panel-soft-bg)]"
                          onClick={() => scrollToPart(part.slug)}
                        >
                          <span className="mt-0.5 shrink-0 text-xs text-soft">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-muted group-hover:text-main group-hover:underline group-hover:underline-offset-4">
                            {part.title}
                          </span>
                        </button>
                      ))}
                    </nav>
                  )}
                </div>
              </aside>

              <div className="space-y-6">
                {sortedParts.map((part, index) => (
                  <PartSection
                    key={part.id}
                    seriesSlug={series.slug}
                    part={part}
                    initialOpen={index === 0}
                    partRef={(node) => {
                      partRefs.current[part.slug] = node;
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="surface-card px-6 py-10 text-sm text-soft">
              暂无分部。
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default ComicSeriesPage;