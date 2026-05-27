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
      <span className="text-sm font-bold text-white">
        {novel.title}
      </span>
    </div>
  );
}

function FeaturedNovelCard({ novel }: { novel: NovelListItem }) {
  return (
    <Link
      to={`/works/novels/${novel.slug}`}
      className="group block overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-panel-bg)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="grid min-h-[220px] gap-0 md:grid-cols-[150px_minmax(0,1fr)]">
        <div className="flex items-center justify-center border-b border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] px-5 py-6 md:border-b-0 md:border-r">
          <div className="h-[160px] w-[100px] overflow-hidden rounded-sm shadow-lg">
            <NovelCoverOnly novel={novel} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between p-5 md:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] link-accent">
              Recently Updated
            </p>

            <h2 className="mt-3 text-2xl font-bold leading-tight text-main md:text-3xl">
              {novel.title}
            </h2>

            <p className="mt-4 line-clamp-3 text-sm leading-7 text-muted">
              {novel.summary || "暂无小说简介。"}
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border-soft)] pt-3">
            <span className="text-xs text-soft">
              更新于 {formatDate(novel.updatedAt)}
            </span>

            <span className="text-sm font-semibold link-accent">
              进入目录 →
            </span>
          </div>
        </div>
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
    <main className="page-shell min-h-[100dvh] pb-14">
      <section className="mx-auto max-w-[1250px] px-6 py-8 md:px-8">
        <header className="grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(420px,1.2fr)] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] link-accent">
              Novels
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-main md:text-4xl">
              小说随笔
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
              收录小说正文，博客简介。最近更新会优先展示，其他作品按书架形式陈列。
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-[var(--color-panel-soft-bg)] px-3 py-1 text-soft">
                共 {sortedNovels.length} 部小说
              </span>

              {canManageNovels && (
                <Link
                  to="/creator/novels"
                  className="rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-3 py-1 font-semibold link-accent transition hover:border-[var(--color-accent-border-strong)]"
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

        <section className="mt-8">
          {isLoading && (
            <section className="surface-card px-6 py-8">
              <p className="text-sm text-soft">正在加载小说列表...</p>
            </section>
          )}

          {errorMessage && (
            <section>
              <p className="message-error p-4 text-sm">{errorMessage}</p>
            </section>
          )}

          {!isLoading && !errorMessage && sortedNovels.length === 0 && (
            <section className="surface-card px-6 py-8">
              <p className="text-sm text-soft">暂无小说。</p>
            </section>
          )}

          {!isLoading && !errorMessage && sortedNovels.length > 0 && (
            <section className="surface-card overflow-hidden">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border-soft)] px-5 py-4 md:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] link-accent">
                    Library
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-main">
                    全部小说
                  </h2>
                </div>

                <span className="text-sm text-soft">
                  按最近更新时间排序
                </span>
              </div>

              <div className="px-5 py-6 md:px-6">
                <div className="grid grid-cols-[repeat(auto-fill,104px)] justify-center gap-x-7 gap-y-9 sm:grid-cols-[repeat(auto-fill,118px)] md:justify-start">
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