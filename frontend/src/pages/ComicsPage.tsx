import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { getMe, type AuthUser } from "../api/auth";
import {
  getComicSeriesList,
  resolveAssetUrl,
  type ComicSeriesListItem,
} from "../api/comics";

function EmptyComicCover({ title }: { title: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 px-6 text-center">
      <div className="absolute inset-y-0 left-0 w-5 border-r border-black/20 bg-black/15" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-white/10" />
      <p className="relative text-xl font-semibold leading-8 text-white">
        {title}
      </p>
    </div>
  );
}

function SeriesShelfCard({ series }: { series: ComicSeriesListItem }) {
  const coverUrl = resolveAssetUrl(series.coverUrl);

  return (
    <Link
      to={`/works/comics/${series.slug}`}
      className="group block w-32 sm:w-36"
    >
      <div className="relative aspect-[5/7] overflow-hidden rounded-xl bg-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="absolute inset-y-0 left-0 z-10 w-4 border-r border-black/10 bg-black/10" />

        <div className="absolute inset-0 border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)]">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={series.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <EmptyComicCover title={series.title} />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-white/10" />
          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/14" />
        </div>
      </div>

      <div className="mt-3 min-h-[78px]">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-main group-hover:underline group-hover:underline-offset-4">
          {series.title}
        </h3>

        {series.summary ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
            {series.summary}
          </p>
        ) : (
          <p className="mt-1 text-xs leading-5 text-soft">暂无简介</p>
        )}
      </div>
    </Link>
  );
}

function FeaturedOverlayCard({ series }: { series: ComicSeriesListItem }) {
  const coverUrl = resolveAssetUrl(series.coverUrl);

  return (
    <Link
      to={`/works/comics/${series.slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-white/35 bg-white/32 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-[2px] transition hover:-translate-y-0.5 hover:bg-white/40 hover:shadow-md"
    >
      <div className="grid min-h-[280px] md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="relative overflow-hidden border-b border-white/40 bg-[var(--color-panel-soft-bg)] md:border-b-0 md:border-r">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={series.title}
              decoding="async"
              className="h-full min-h-[280px] w-full object-cover"
            />
          ) : (
            <EmptyComicCover title={series.title} />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-white/10" />
        </div>

        <div className="flex flex-col justify-between bg-white/18 px-6 py-6 md:px-8 md:py-7">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] link-accent">
              Featured Comic
            </p>

            <h2 className="mt-4 text-3xl font-bold leading-tight text-main md:text-4xl group-hover:underline group-hover:underline-offset-4">
              {series.title}
            </h2>

            {series.summary ? (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted md:text-base">
                {series.summary}
              </p>
            ) : (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-soft md:text-base">
                暂无系列简介。
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border-soft)] pt-4">
            <span className="text-sm text-soft">{series.status}</span>
            <span className="text-sm font-semibold link-accent">
              进入目录 →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ComicsPage() {
  const [seriesList, setSeriesList] = useState<ComicSeriesListItem[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPageData() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [seriesData, userResult] = await Promise.allSettled([
          getComicSeriesList(),
          getMe(),
        ]);

        if (seriesData.status === "fulfilled") {
          setSeriesList(seriesData.value);
        } else {
          throw seriesData.reason;
        }

        if (userResult.status === "fulfilled") {
          setCurrentUser(userResult.value);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error(error);

        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("漫画列表加载失败。");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadPageData();
  }, []);

  const sortedSeriesList = useMemo(
    () => [...seriesList].sort((a, b) => a.displayOrder - b.displayOrder),
    [seriesList],
  );

  const featuredSeries = sortedSeriesList[0] ?? null;
  const shelfSeries = sortedSeriesList.slice(1);

  const canUploadComics =
    currentUser?.role === "author" || currentUser?.role === "admin";

  const heroBgUrl = "/images/ComicsPageHero.webp";
  const heroBgPosition = "0% 55%";
  const heroBgSize = "100% auto";

  return (
    <main className="page-shell min-h-[100dvh] pb-16">
      <section className="relative">
        <div
          className="relative min-h-[500px] overflow-hidden"
          style={
            heroBgUrl
              ? {
                  backgroundImage: `
                    linear-gradient(
                      90deg,
                      rgba(15,23,42,0.78) 0%,
                      rgba(15,23,42,0.55) 28%,
                      rgba(15,23,42,0.34) 55%,
                      rgba(15,23,42,0.58) 100%
                    ),
                    url(${heroBgUrl})
                  `,
                  backgroundSize: heroBgSize,
                  backgroundPosition: heroBgPosition,
                }
              : {
                  background:
                    "linear-gradient(135deg, #0f172a 0%, #1e3a8a 48%, #60a5fa 100%)",
                }
          }
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.07),transparent_28%)]" />

          <div className="relative mx-auto flex min-h-[500px] max-w-7xl flex-col justify-between px-6 py-12 md:px-10 md:py-14">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-blue-200">
                  Comics
                </p>

                <h1 className="mt-4 text-5xl font-bold leading-tight text-white md:text-6xl">
                  漫画主页
                </h1>

                <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 md:text-lg">
                  这里整理漫画系列、分部目录和章节阅读入口。点击封面进入系列目录，再选择章节开始阅读。
                </p>
              </div>

              {canUploadComics && (
                <Link
                  to="/creator/comics"
                  className="shrink-0 rounded-xl border border-white/25 bg-white/12 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-white/18 hover:underline hover:underline-offset-4"
                >
                  进入创作者上传
                </Link>
              )}
            </div>

            <div className="mt-10">
              <div className="h-px w-full bg-gradient-to-r from-white/80 via-white/35 to-transparent" />
              <div className="mt-3 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-slate-300">
                <span>Featured Entrance</span>
                <span className="h-px flex-1 bg-white/20" />
              </div>
            </div>
          </div>
        </div>

        {featuredSeries && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1/2">
            <div className="mx-auto w-[calc(100%-2rem)] max-w-5xl">
              <div className="pointer-events-auto relative">
                <FeaturedOverlayCard series={featuredSeries} />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 md:px-10">
        <div className={featuredSeries ? "pt-48" : "pt-12"}>
          {isLoading && (
            <section className="surface-card px-6 py-10">
              <p className="text-sm text-soft">正在加载漫画列表...</p>
            </section>
          )}

          {errorMessage && (
            <section>
              <p className="message-error p-4 text-sm">{errorMessage}</p>
            </section>
          )}

          {!isLoading && !errorMessage && sortedSeriesList.length === 0 && (
            <section className="surface-card px-6 py-10">
              <p className="text-sm text-soft">暂无漫画系列。</p>
            </section>
          )}

          {!isLoading && !errorMessage && sortedSeriesList.length > 0 && (
            <section className="mt-2">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                    Library
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-main">
                    全部漫画
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                    系列数量不会太多，因此这里采用封面书架式陈列，保留更明确的漫画主页感。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,128px)] justify-center gap-x-10 gap-y-12 sm:grid-cols-[repeat(auto-fill,144px)] md:justify-start">
                {featuredSeries && <SeriesShelfCard series={featuredSeries} />}

                {shelfSeries.map((series) => (
                  <SeriesShelfCard key={series.id} series={series} />
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

export default ComicsPage;