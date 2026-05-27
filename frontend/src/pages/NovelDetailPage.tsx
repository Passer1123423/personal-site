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
    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-[var(--color-accent-soft)] to-white p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] link-accent">
          Novel
        </p>

        <h2 className="mt-4 text-xl font-bold leading-tight text-main">
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
    <main className="page-shell min-h-[100dvh] pb-16">
      <section className="mx-auto max-w-[1250px] px-6 py-8 md:px-8">
        <Link
          to="/works/novels"
          className="mb-4 inline-block text-sm font-semibold link-accent"
        >
          ← 返回小说存档
        </Link>

        {isLoading && (
          <section className="surface-card px-6 py-8">
            <p className="text-sm text-soft">正在加载小说详情...</p>
          </section>
        )}

        {errorMessage && (
          <section>
            <p className="message-error p-4 text-sm">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && novel && (
          <section className="novel-detail-frame surface-card">
            <header className="novel-detail-header">
              <div className="novel-detail-cover">
                <NovelCover novel={novel} />
              </div>

              <div className="novel-detail-main">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] link-accent">
                  Novel Detail
                </p>

                <h1 className="mt-3 text-3xl font-bold leading-tight text-main md:text-4xl">
                  {novel.title}
                </h1>

                {canManageNovel && (
                  <div className="mt-4">
                    <Link
                      to={`/creator/novels/${novel.slug}`}
                      className="inline-flex rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-[var(--color-panel-soft-bg)] link-accent"
                    >
                      管理这本小说
                    </Link>
                  </div>
                )}

                <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted md:text-base">
                  {novel.summary || "暂无小说简介。"}
                </p>

                <div className="novel-detail-meta">
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

            <div className="novel-detail-body">
              <section className="novel-detail-chapters">
                <div className="novel-detail-section-heading">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] link-accent">
                      Chapters
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-main">
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
                  <div className="novel-detail-chapter-list">
                    {chapters.map((chapter) => (
                      <Link
                        key={chapter.id}
                        to={`/works/novels/${novel.slug}/${chapter.slug}`}
                        className="novel-detail-chapter-link group"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-main group-hover:text-[var(--color-accent)]">
                            {chapter.title}
                          </p>

                          <p className="mt-1 text-xs text-soft">
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

              <aside className="novel-detail-discussion">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] link-accent">
                  Reader Area
                </p>

                <h2 className="mt-2 text-xl font-bold text-main">
                  评论区预留
                </h2>

                <p className="mt-4 text-sm leading-7 text-muted">
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