import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import CreatorBookCard from "../components/creator/CreatorBookCard";
import { getMe, type AuthUser } from "../api/auth";
import { getNovelList, type NovelListItem } from "../api/novels";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function NovelCoverOnly({ novel }: { novel: NovelListItem }) {
  if (novel.coverUrl) {
    return (
      <img
        src={novel.coverUrl}
        alt={novel.title}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-950 to-blue-700 px-4 text-center">
      <span className="text-xs font-bold text-white md:text-sm">
        {novel.title}
      </span>
    </div>
  );
}

function FeaturedNovelCard({ novel }: { novel: NovelListItem }) {
  return (
    <Link
      to={`/works/novels/${novel.slug}`}
      className="group block border-y border-[var(--color-border-soft)] py-4 transition hover:bg-[var(--color-panel-soft-bg)] md:overflow-hidden md:rounded-xl md:border md:bg-[var(--color-panel-bg)] md:py-0 md:shadow-sm md:hover:-translate-y-0.5 md:hover:bg-[var(--color-panel-bg)] md:hover:shadow-md"
    >
      <div className="grid min-h-0 grid-cols-[82px_minmax(0,1fr)] gap-x-4 gap-y-3 md:min-h-[220px] md:grid-cols-[150px_minmax(0,1fr)] md:gap-0">
        <div className="flex items-start justify-center bg-transparent md:items-center md:border-r md:border-[var(--color-border-soft)] md:bg-[var(--color-panel-soft-bg)] md:px-5 md:py-6">
          <div className="h-[116px] w-[72px] overflow-hidden rounded-sm shadow-md md:h-[160px] md:w-[100px] md:shadow-lg">
            <NovelCoverOnly novel={novel} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between py-0 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] link-accent md:text-xs md:tracking-[0.22em]">
              Recently Updated
            </p>

            <h2 className="mt-1.5 line-clamp-2 text-lg font-bold leading-6 text-main md:mt-3 md:text-3xl md:leading-tight">
              {novel.title}
            </h2>

            <p className="mt-2 hidden line-clamp-3 text-sm leading-6 text-muted md:mt-4 md:block md:leading-7">
              {novel.summary || "暂无小说简介。"}
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-1 border-t border-[var(--color-border-soft)] pt-2 md:mt-5 md:flex-row md:items-center md:justify-between md:gap-3 md:pt-3">
            <span className="min-w-0 truncate text-xs text-soft">
              更新于 {formatDate(novel.updatedAt)}
            </span>

            <span className="shrink-0 text-xs font-semibold link-accent md:text-sm">
              进入目录 →
            </span>
          </div>
        </div>

        <p className="col-span-2 line-clamp-3 text-sm leading-6 text-muted md:hidden">
          {novel.summary || "暂无小说简介。"}
        </p>
      </div>
    </Link>
  );
}

function NovelsPage() {
  const [novels, setNovels] = useState<NovelListItem[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPageData() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [novelResult, userResult] = await Promise.allSettled([
          getNovelList(),
          getMe(),
        ]);

        if (novelResult.status === "fulfilled") {
          setNovels(novelResult.value);
        } else {
          throw novelResult.reason;
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
          setErrorMessage("小说列表加载失败。");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadPageData();
  }, []);

  const sortedNovels = useMemo(
    () => [...novels].sort((a, b) => a.displayOrder - b.displayOrder),
    [novels],
  );

  const featuredNovel = sortedNovels[0] ?? null;
  const shelfNovels = featuredNovel ? sortedNovels.slice(1) : sortedNovels;

  const canManageNovels =
    currentUser?.role === "author" || currentUser?.role === "admin";

  return (
    <main className="page-shell min-h-[100dvh] pb-10 md:pb-14">
      <section className="mx-auto max-w-[1250px] px-4 py-7 md:px-8 md:py-8">
        <header className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(420px,1.2fr)] md:items-end md:gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] link-accent md:tracking-[0.28em] max-md:hidden">
              Novels
            </p>

            <h1 className="mt-2 text-2xl font-bold leading-tight text-main md:mt-3 md:text-4xl">
              小说随笔
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-muted md:mt-4 md:leading-7">
              收录小说正文，博客简介。最近更新会优先展示，其他作品按书架形式陈列。
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm md:mt-5 md:gap-3">
              <span className="rounded-full bg-[var(--color-panel-soft-bg)] px-3 py-1 text-xs text-soft md:text-sm">
                共 {sortedNovels.length} 部小说
              </span>

              {canManageNovels && (
                <Link
                  to="/creator/novels"
                  className="rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold link-accent transition hover:border-[var(--color-accent-border-strong)] md:text-sm"
                >
                  进入小说管理
                </Link>
              )}
            </div>
          </div>

          {!isLoading && !errorMessage && featuredNovel && (
            <section>
              <FeaturedNovelCard novel={featuredNovel} />
            </section>
          )}
        </header>

        <section className="mt-6 md:mt-8">
          {isLoading && (
            <section className="border-y border-[var(--color-border-soft)] py-6 md:surface-card md:px-6 md:py-8">
              <p className="text-sm text-soft">正在加载小说列表...</p>
            </section>
          )}

          {errorMessage && (
            <section>
              <p className="message-error p-4 text-sm">{errorMessage}</p>
            </section>
          )}

          {!isLoading && !errorMessage && sortedNovels.length === 0 && (
            <section className="border-y border-[var(--color-border-soft)] py-6 md:surface-card md:px-6 md:py-8">
              <p className="text-sm text-soft">暂无小说。</p>
            </section>
          )}

          {!isLoading && !errorMessage && sortedNovels.length > 0 && (
            <section className="border-y border-[var(--color-border-soft)] py-4 md:surface-card md:overflow-hidden md:border-y-0 md:py-0">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--color-border-soft)] pb-4 md:gap-3 md:px-6 md:py-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] link-accent md:text-xs md:tracking-[0.22em]">
                    Library
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-main md:text-xl">
                    全部小说
                  </h2>
                </div>

                <span className="text-xs text-soft md:text-sm">
                  按最近更新时间排序
                </span>
              </div>

              <div className="pt-5 md:px-6 md:py-6">
                <div className="grid grid-cols-[repeat(auto-fill,96px)] justify-center gap-x-5 gap-y-7 sm:grid-cols-[repeat(auto-fill,128px)] sm:gap-x-7 sm:gap-y-9 md:justify-start">
                  {featuredNovel && (
                    <CreatorBookCard
                      title={featuredNovel.title}
                      summary={featuredNovel.summary}
                      coverUrl={featuredNovel.coverUrl}
                      href={`/works/novels/${featuredNovel.slug}`}
                      meta="最近更新"
                    />
                  )}

                  {shelfNovels.map((novel) => (
                    <CreatorBookCard
                      key={novel.id}
                      title={novel.title}
                      summary={novel.summary}
                      coverUrl={novel.coverUrl}
                      href={`/works/novels/${novel.slug}`}
                      meta={`更新于 ${formatDate(novel.updatedAt)}`}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

export default NovelsPage;