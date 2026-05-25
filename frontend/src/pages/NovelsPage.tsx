import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import CreatorBookCard from "../components/creator/CreatorBookCard";
import { getMe, type AuthUser } from "../api/auth";
import { getNovelList, type NovelListItem } from "../api/novels";

function FeaturedNovelCard({ novel }: { novel: NovelListItem }) {
  return (
    <Link
      to={`/works/novels/${novel.slug}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex min-h-[280px] items-center justify-center border-b border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] px-8 md:border-b-0 md:border-r">
          <CreatorBookCard
            title={novel.title}
            summary={novel.summary}
            coverUrl={novel.coverUrl}
            href={`/works/novels/${novel.slug}`}
            meta="最近更新"
          />
        </div>

        <div className="flex flex-col justify-between p-7 md:p-9">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
              Featured Novel
            </p>

            <h2 className="mt-4 text-3xl font-bold leading-tight text-main md:text-4xl group-hover:underline group-hover:underline-offset-4">
              {novel.title}
            </h2>

            {novel.summary ? (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted md:text-base">
                {novel.summary}
              </p>
            ) : (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-soft md:text-base">
                暂无小说简介。
              </p>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-[var(--color-border-soft)] pt-4">
            <span className="text-sm text-soft">
              更新于 {new Date(novel.updatedAt).toLocaleDateString()}
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
    <main className="page-shell min-h-[100dvh] pb-16">
      <section className="border-b border-[var(--color-border-soft)] bg-[var(--color-panel-bg)]">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] link-accent">
                Novels
              </p>

              <h1 className="mt-4 text-4xl font-bold leading-tight text-main md:text-5xl">
                小说存档
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-muted">
                收录小说正文、章节目录和后续评论入口。这里采用书架式陈列，点击封面进入小说详情页。
              </p>
            </div>

            {canManageNovels && (
              <Link
                to="/admin/novels"
                className="rounded-xl border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-5 py-3 text-sm font-semibold link-accent transition hover:border-[var(--color-accent-border-strong)]"
              >
                进入小说管理
              </Link>
            )}
          </div>

          <div className="mt-10 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] px-6 py-8 md:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-main">书架</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  按最近更新时间排序。新写或修改过的小说会靠前显示。
                </p>
              </div>

              <span className="text-sm text-soft">
                共 {sortedNovels.length} 部小说
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-10">
        {isLoading && (
          <section className="surface-card px-6 py-10">
            <p className="text-sm text-soft">正在加载小说列表...</p>
          </section>
        )}

        {errorMessage && (
          <section>
            <p className="message-error p-4 text-sm">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && sortedNovels.length === 0 && (
          <section className="surface-card px-6 py-10">
            <p className="text-sm text-soft">暂无小说。</p>
          </section>
        )}

        {!isLoading && !errorMessage && featuredNovel && (
          <section>
            <div className="mb-7">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                Recently Updated
              </p>

              <h2 className="mt-2 text-2xl font-bold text-main">
                最近更新
              </h2>
            </div>

            <FeaturedNovelCard novel={featuredNovel} />
          </section>
        )}

        {!isLoading && !errorMessage && sortedNovels.length > 0 && (
          <section className="mt-14">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border-soft)] pb-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                  Library
                </p>

                <h2 className="mt-2 text-2xl font-bold text-main">
                  全部小说
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,112px)] justify-center gap-x-9 gap-y-12 sm:grid-cols-[repeat(auto-fill,128px)] md:justify-start">
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
                  meta={`更新于 ${new Date(novel.updatedAt).toLocaleDateString()}`}
                />
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default NovelsPage;