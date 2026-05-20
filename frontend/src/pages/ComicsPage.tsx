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

function FeaturedSeriesCard({ series }: { series: ComicSeriesListItem }) {
  const coverUrl = resolveAssetUrl(series.coverUrl);

  return (
    <Link
      to={`/works/comics/${series.slug}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="grid min-h-[360px] lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="relative min-h-[360px] overflow-hidden border-b border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] lg:border-b-0 lg:border-r">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={series.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <EmptyComicCover title={series.title} />
          )}

          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
        </div>

        <div className="flex flex-col justify-between p-7 md:p-9">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
              Featured Comic
            </p>

            <h2 className="mt-4 text-4xl font-bold leading-tight text-main group-hover:underline group-hover:underline-offset-4">
              {series.title}
            </h2>

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

          <div className="mt-8 flex items-center justify-between border-t border-[var(--color-border-soft)] pt-5">
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

function SeriesShelfCard({ series }: { series: ComicSeriesListItem }) {
  const coverUrl = resolveAssetUrl(series.coverUrl);

  return (
    <Link
      to={`/works/comics/${series.slug}`}
      className="group block w-32 sm:w-36"
    >
      <div className="relative aspect-[5/7] overflow-hidden rounded-xl bg-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_16px_32px_rgba(15,23,42,0.22)]">
        <div className="absolute inset-y-0 left-0 z-10 w-4 border-r border-black/10 bg-black/10" />

        <div className="absolute inset-0 border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)]">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={series.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <EmptyComicCover title={series.title} />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-white/10" />
          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
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
  const restSeries = sortedSeriesList.slice(1);

  const canUploadComics =
    currentUser?.role === "author" || currentUser?.role === "admin";

  return (
    <main className="page-shell min-h-[100dvh] px-6 py-14">
      <section className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm">
          <div className="relative px-7 py-10 md:px-10 md:py-12">
            <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-[var(--color-accent-soft)] to-transparent md:block" />

            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                  Comics
                </p>

                <h1 className="mt-3 text-4xl font-bold leading-tight text-main md:text-5xl">
                  漫画主页
                </h1>

                <p className="mt-5 max-w-3xl text-base leading-8 text-muted">
                  这里整理漫画系列、分部目录和章节阅读入口。点击任意封面进入系列目录，再选择章节开始阅读。
                </p>
              </div>

              {canUploadComics && (
                <Link
                  to="/creator/comics"
                  className="admin-button-primary shrink-0 px-5 py-3 text-sm font-semibold"
                >
                  进入创作者上传
                </Link>
              )}
            </div>
          </div>
        </section>

        {isLoading && (
          <section className="surface-card mt-8 px-6 py-10">
            <p className="text-sm text-soft">正在加载漫画列表...</p>
          </section>
        )}

        {errorMessage && (
          <section className="mt-8">
            <p className="message-error p-4 text-sm">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && sortedSeriesList.length === 0 && (
          <section className="surface-card mt-8 px-6 py-10">
            <p className="text-sm text-soft">暂无漫画系列。</p>
          </section>
        )}

        {!isLoading && !errorMessage && featuredSeries && (
          <>
            <section className="mt-10">
              <FeaturedSeriesCard series={featuredSeries} />
            </section>

            <section className="mt-14">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                    Library
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-main">
                    全部漫画
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                    由于系列数量不会太多，这里采用封面书架式陈列，保留更强的漫画主页感。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,128px)] justify-center gap-x-10 gap-y-12 sm:grid-cols-[repeat(auto-fill,144px)] md:justify-start">
                <SeriesShelfCard series={featuredSeries} />

                {restSeries.map((series) => (
                  <SeriesShelfCard key={series.id} series={series} />
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

export default ComicsPage;