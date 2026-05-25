import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

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
        className="h-full w-full rounded-2xl object-cover shadow-md"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-between rounded-2xl border border-[var(--color-border-soft)] bg-gradient-to-br from-[var(--color-accent-soft)] to-white p-6 shadow-md">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] link-accent">
          Novel
        </p>
        <h2 className="mt-4 line-clamp-4 text-2xl font-bold leading-tight text-main">
          {novel.title}
        </h2>
      </div>

      <p className="text-sm text-soft">暂无封面</p>
    </div>
  );
}

function NovelDetailPage() {
  const { novelSlug } = useParams<{ novelSlug: string }>();

  const [novel, setNovel] = useState<NovelDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    <main className="page-shell min-h-[100dvh] pb-16">
      <section className="border-b border-[var(--color-border-soft)] bg-[var(--color-panel-bg)]">
        <div className="mx-auto max-w-7xl px-6 py-10 md:px-10">
          <Link
            to="/works/novels"
            className="text-sm font-semibold link-accent"
          >
            ← 返回小说存档
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 md:px-10">
        {isLoading && (
          <section className="surface-card px-6 py-10">
            <p className="text-sm text-soft">正在加载小说详情...</p>
          </section>
        )}

        {errorMessage && (
          <section>
            <p className="message-error p-4 text-sm">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && novel && (
          <>
            <section className="surface-card overflow-hidden">
              <div className="grid gap-8 p-6 md:grid-cols-[260px_minmax(0,1fr)] md:p-8 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="mx-auto h-[380px] w-[240px] md:mx-0">
                  <NovelCover novel={novel} />
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                      Novel Detail
                    </p>

                    <h1 className="mt-4 text-4xl font-bold leading-tight text-main md:text-5xl">
                      {novel.title}
                    </h1>

                    <p className="mt-5 max-w-3xl whitespace-pre-line text-base leading-8 text-muted">
                      {novel.summary || "暂无小说简介。"}
                    </p>
                  </div>

                  <div className="mt-8 grid gap-3 border-t border-[var(--color-border-soft)] pt-5 text-sm text-soft sm:grid-cols-3">
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
              </div>
            </section>

            <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
              <section className="surface-card p-6 md:p-8">
                <div className="mb-6 flex items-end justify-between gap-4 border-b border-[var(--color-border-soft)] pb-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                      Chapters
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-main">
                      章节目录
                    </h2>
                  </div>

                  <span className="text-sm text-soft">
                    共 {chapters.length} 章
                  </span>
                </div>

                {chapters.length === 0 ? (
                  <p className="text-sm text-soft">暂无章节。</p>
                ) : (
                  <div className="divide-y divide-[var(--color-border-soft)]">
                    {chapters.map((chapter) => (
                      <Link
                        key={chapter.id}
                        to={`/works/novels/${novel.slug}/${chapter.slug}`}
                        className="group flex items-center justify-between gap-4 py-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-main group-hover:text-[var(--color-accent)]">
                            {chapter.title}
                          </p>
                          <p className="mt-1 text-sm text-soft">
                            更新于 {formatDate(chapter.updatedAt)}
                          </p>
                        </div>

                        <span className="shrink-0 text-sm font-semibold link-accent">
                          阅读 →
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <aside className="surface-card h-fit p-6 md:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
                  Reader Area
                </p>

                <h2 className="mt-2 text-xl font-bold text-main">
                  评论区预留
                </h2>

                <p className="mt-4 text-sm leading-7 text-muted">
                  这里暂时作为读者讨论区、作者说明或更新记录的预留位置。后续可以接评论、点赞、阅读记录等功能。
                </p>
              </aside>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

export default NovelDetailPage;