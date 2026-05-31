import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  getComicSeriesDetail,
  resolveAssetUrl,
  type ComicChapterItem,
  type ComicPartItem,
  type ComicSeriesDetail,
} from "../api/comics";
import CreatorBookCard from "../components/creator/CreatorBookCard";

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

function MobileChapterListItem({
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
      className="block border-b border-[var(--color-border-soft)] py-3 text-sm text-main transition hover:text-[var(--color-accent)]"
    >
      <span className="line-clamp-1 font-medium">{chapter.title}</span>
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

  const firstChapter = sortedChapters[0] ?? null;
  const mobileCardHref = firstChapter
    ? `/works/comics/${seriesSlug}/${part.slug}/${firstChapter.slug}`
    : `/works/comics/${seriesSlug}`;

  return (
    <article ref={partRef} className="scroll-mt-24">
      <div className="md:hidden">
        <div className="border-b border-[var(--color-border-soft)] py-4">
          <div className="flex items-start gap-3">
            <CreatorBookCard
              title={part.title}
              summary={part.summary}
              coverUrl={part.coverUrl}
              href={mobileCardHref}
              meta={
                sortedChapters.length > 0
                  ? `${sortedChapters.length} 章`
                  : "暂无章节"
              }
            />

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] link-accent">
                Part
              </p>

              <h2 className="mt-1.5 line-clamp-2 text-base font-bold leading-6 text-main">
                {part.title}
              </h2>

              {part.summary ? (
                <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted">
                  {part.summary}
                </p>
              ) : (
                <p className="mt-1.5 text-sm leading-5 text-soft">
                  暂无分部简介。
                </p>
              )}

              <button
                type="button"
                className="mt-3 inline-flex rounded-lg border border-[var(--color-border-control)] bg-white px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-[var(--color-accent-border-strong)] hover:text-[var(--color-accent)]"
                onClick={() => setIsOpen((value) => !value)}
              >
                {isOpen ? "收起章节" : "展开章节"}
              </button>
            </div>
          </div>

          {isOpen && (
            <div className="mt-3 border-t border-[var(--color-border-soft)]">
              {sortedChapters.length > 0 ? (
                <div>
                  {sortedChapters.map((chapter) => (
                    <MobileChapterListItem
                      key={chapter.id}
                      seriesSlug={seriesSlug}
                      partSlug={part.slug}
                      chapter={chapter}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-sm text-soft">暂无章节。</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <article className="overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white shadow-sm">
          <button
            type="button"
            className="group grid w-full min-h-32 text-left transition hover:bg-[var(--color-panel-soft-bg)] sm:grid-cols-[150px_minmax(0,1fr)] md:grid-cols-[132px_minmax(0,1fr)]"
            onClick={() => setIsOpen((value) => !value)}
          >
            <div className="hidden h-full min-h-32 overflow-hidden border-r border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] sm:block">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={part.title}
                  className="h-full min-h-32 w-full object-cover"
                />
              ) : (
                <EmptyCover title={part.title} />
              )}
            </div>

            <div className="flex min-w-0 items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-main group-hover:underline group-hover:underline-offset-4">
                  {part.title}
                </h2>

                {part.summary ? (
                  <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-muted">
                    {part.summary}
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-soft">
                    暂无分部简介。
                  </p>
                )}
              </div>

              <span className="shrink-0 text-xl font-light text-soft transition group-hover:text-muted">
                {isOpen ? "−" : "+"}
              </span>
            </div>
          </button>

          {isOpen && (
            <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] px-4 py-4">
              {sortedChapters.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
      </div>
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
  const chapterCount = sortedParts.reduce(
    (total, part) => total + part.chapters.length,
    0,
  );

  return (
    <main className="page-shell min-h-[100dvh] px-4 py-8 md:px-8 md:py-8">
      <section className="mx-auto max-w-[1120px]">
        <Link to="/works/comics" className="link-accent text-sm font-semibold">
          ← 返回漫画存档
        </Link>

        <section className="mt-5 border-b border-[var(--color-border-soft)] pb-5 md:hidden">
          <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-4">
            <div className="flex items-start justify-center">
              <div className="aspect-[5/7] w-[72px] overflow-hidden rounded-sm bg-[var(--color-panel-soft-bg)] shadow-md">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={series.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <EmptyCover title={series.title} />
                )}
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] link-accent">
                Comic Series
              </p>

              <h1 className="mt-1.5 line-clamp-2 text-xl font-bold leading-7 text-main">
                {series.title}
              </h1>

              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-soft">
                <div>
                  <p className="font-semibold text-main">分部</p>
                  <p className="mt-0.5">{sortedParts.length} 个</p>
                </div>

                <div>
                  <p className="font-semibold text-main">章节</p>
                  <p className="mt-0.5">{chapterCount} 章</p>
                </div>

                <div>
                  <p className="font-semibold text-main">Slug</p>
                  <p className="mt-0.5 truncate">{series.slug}</p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted">
            {series.summary || "暂无系列简介。"}
          </p>

          <p className="mt-3 border-t border-[var(--color-border-soft)] pt-3 text-sm leading-6 text-soft">
            选择下方分部展开目录，点击章节进入阅读。
          </p>
        </section>

        <section className="mt-6 hidden overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white shadow-sm md:block">
          <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="relative min-h-72 border-b border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] lg:border-b-0 lg:border-r">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={series.title}
                  className="h-full min-h-72 w-full object-cover"
                />
              ) : (
                <EmptyCover title={series.title} />
              )}
            </div>

            <div className="flex flex-col justify-between p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] link-accent">
                  Comic Series
                </p>

                <h1 className="mt-3 text-3xl font-bold leading-tight text-main">
                  {series.title}
                </h1>

                {series.summary ? (
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
                    {series.summary}
                  </p>
                ) : (
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-soft">
                    暂无系列简介。
                  </p>
                )}
              </div>

              <div className="mt-6 border-t border-[var(--color-border-soft)] pt-4">
                <p className="text-sm leading-6 text-soft">
                  选择下方分部展开目录，点击章节进入阅读。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 md:mt-8">
          <div className="mb-4 border-b border-[var(--color-border-soft)] pb-4 md:mb-5 md:border-b-0 md:pb-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] link-accent md:tracking-[0.22em]">
              Contents
            </p>

            <h2 className="mt-2 text-xl font-bold text-main">
              分部目录
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              每个分部可以展开查看章节。左侧目录可以快速跳转到对应分部。
            </p>
          </div>

          {sortedParts.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
              <aside className="hidden lg:block">
                <div className="sticky top-24 overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white shadow-sm">
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

              <div className="space-y-0 md:space-y-4">
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
            <div className="border-y border-[var(--color-border-soft)] py-6 text-sm text-soft md:surface-card md:px-6 md:py-10">
              暂无分部。
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default ComicSeriesPage;
