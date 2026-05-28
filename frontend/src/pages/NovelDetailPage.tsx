import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { getAccessToken } from "../api/auth";
import { fetchAuthorNovelsTree } from "../api/authorNovels";

import {
  getNovelDetail,
  resolveAssetUrl,
  type NovelDetail,
} from "../api/novels";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function NovelCover({ novel }: { novel: NovelDetail }) {
  const coverUrl = resolveAssetUrl(novel.coverUrl);

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={novel.title}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-[var(--color-accent-soft)] to-white p-3 md:p-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] link-accent md:text-xs md:tracking-[0.22em]">
          Novel
        </p>

        <h2 className="mt-2 line-clamp-3 text-sm font-bold leading-5 text-main md:mt-4 md:text-xl md:leading-tight">
          {novel.title}
        </h2>
      </div>

      <p className="text-xs text-soft md:text-sm">暂无封面</p>
    </div>
  );
}

function NovelDetailPage() {
  const { novelSlug } = useParams<{ novelSlug: string }>();

  const [novel, setNovel] = useState<NovelDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [canManageNovel, setCanManageNovel] = useState(false);

  useEffect(() => {
    async function loadNovel() {
      if (!novelSlug) {
        setErrorMessage("缺少小说 slug。");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const data = await getNovelDetail(novelSlug);
        setNovel(data);

        const token = getAccessToken();

        if (!token) {
          setCanManageNovel(false);
          return;
        }

        try {
          const authorNovels = await fetchAuthorNovelsTree();

          setCanManageNovel(
            authorNovels.some((authorNovel) => authorNovel.slug === data.slug),
          );
        } catch {
          setCanManageNovel(false);
        }
      } catch (error) {
        console.error(error);

        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("小说详情加载失败。");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadNovel();
  }, [novelSlug]);

  const chapters = useMemo(() => {
    if (!novel) return [];

    return [...novel.chapters].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
  }, [novel]);

  return (
    <main className="page-shell min-h-[100dvh] pb-10 md:pb-16">
      <section className="mx-auto max-w-[1250px] px-4 py-6 md:px-8 md:py-8">
        <Link
          to="/works/novels"
          className="mb-4 inline-block text-sm font-semibold link-accent"
        >
          ← 返回小说存档
        </Link>

        {isLoading && (
          <section className="border-y border-[var(--color-border-soft)] py-6 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:px-6 md:py-8 md:shadow-[var(--shadow-card)]">
            <p className="text-sm text-soft">正在加载小说详情...</p>
          </section>
        )}

        {errorMessage && (
          <section>
            <p className="message-error p-4 text-sm">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && novel && (
          <section className="overflow-hidden border-y border-[var(--color-border-soft)] md:rounded-xl md:border md:bg-white md:shadow-sm">
            <header className="grid grid-cols-[86px_minmax(0,1fr)] gap-4 border-b border-[var(--color-border-soft)] py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-7 md:px-8 md:py-7">
              <div className="h-[120px] overflow-hidden rounded-sm border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] md:h-[250px] md:rounded-[0.65rem]">
                <NovelCover novel={novel} />
              </div>

              <div className="flex min-w-0 flex-col justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] link-accent md:text-sm md:tracking-[0.22em]">
                    Novel Detail
                  </p>

                  <h1 className="mt-1.5 line-clamp-2 text-xl font-bold leading-7 text-main md:mt-3 md:text-4xl md:leading-tight">
                    {novel.title}
                  </h1>

                  {canManageNovel && (
                    <div className="mt-2 md:mt-4">
                      <Link
                        to={`/creator/novels/${novel.slug}`}
                        className="inline-flex rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:bg-[var(--color-panel-soft-bg)] link-accent md:rounded-xl md:px-4 md:py-2 md:text-sm"
                      >
                        管理这本小说
                      </Link>
                    </div>
                  )}

                  <p className="mt-2 line-clamp-4 max-w-3xl whitespace-pre-line text-sm leading-6 text-muted md:mt-4 md:line-clamp-none md:text-base md:leading-7">
                    {novel.summary || "暂无小说简介。"}
                  </p>
                </div>

                <div className="mt-3 hidden grid-cols-3 gap-3 border-t border-[var(--color-border-soft)] pt-4 text-sm text-soft md:grid">
                  <div>
                    <p className="font-semibold text-main">章节数</p>
                    <p className="mt-1">{chapters.length} 章</p>
                  </div>

                  <div>
                    <p className="font-semibold text-main">最近更新</p>
                    <p className="mt-1">{formatDate(novel.updatedAt)}</p>
                  </div>

                  <div>
                    <p className="font-semibold text-main">作品标识</p>
                    <p className="mt-1 break-all">{novel.slug}</p>
                  </div>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-3 gap-2 border-b border-[var(--color-border-soft)] py-3 text-xs text-soft md:hidden">
              <div>
                <p className="font-semibold text-main">章节数</p>
                <p className="mt-1">{chapters.length} 章</p>
              </div>

              <div>
                <p className="font-semibold text-main">最近更新</p>
                <p className="mt-1">{formatDate(novel.updatedAt)}</p>
              </div>

              <div>
                <p className="font-semibold text-main">作品标识</p>
                <p className="mt-1 break-all">{novel.slug}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-[340px_minmax(0,1fr)]">
              <section className="border-b border-[var(--color-border-soft)] py-4 md:border-b-0 md:border-r md:px-6 md:py-6">
                <div className="flex items-end justify-between gap-3 border-b border-[var(--color-border-soft)] pb-3 md:pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] link-accent md:text-sm md:tracking-[0.22em]">
                      Chapters
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-main md:mt-2 md:text-xl">
                      章节目录
                    </h2>
                  </div>

                  <span className="text-xs text-soft md:text-sm">
                    共 {chapters.length} 章
                  </span>
                </div>

                {chapters.length === 0 ? (
                  <p className="py-4 text-sm text-soft">暂无章节。</p>
                ) : (
                  <div>
                    {chapters.map((chapter) => (
                      <Link
                        key={chapter.id}
                        to={`/works/novels/${novel.slug}/${chapter.slug}`}
                        className="group flex items-center justify-between gap-3 border-b border-[var(--color-border-soft)] py-3 md:py-3.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-main group-hover:text-[var(--color-accent)]">
                            {chapter.title}
                          </p>

                          <p className="mt-1 text-xs text-soft">
                            更新于 {formatDate(chapter.updatedAt)}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs font-semibold link-accent md:text-sm">
                          阅读 →
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <aside className="py-4 md:px-7 md:py-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] link-accent md:text-sm md:tracking-[0.22em]">
                  Reader Area
                </p>

                <h2 className="mt-1 text-lg font-bold text-main md:mt-2 md:text-xl">
                  评论区预留
                </h2>

                <p className="mt-3 text-sm leading-6 text-muted md:mt-4 md:leading-7">
                  这里暂时作为读者讨论区、作者说明或更新记录的预留位置。后续可以接评论、点赞、阅读记录等功能。
                </p>
              </aside>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default NovelDetailPage;