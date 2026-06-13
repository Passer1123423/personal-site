import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import {
  getComicPartDetail,
  resolveAssetUrl,
  type ComicPartDetailPart,
  type ComicPartDetailResponse,
} from "../api/comics";
import {
  favoriteComicPart,
  getComicPartFavoriteState,
  unfavoriteComicPart,
} from "../api/favorites";
import { getAccessToken, getMe } from "../api/auth";
import FavoriteStarButton from "../components/FavoriteStarButton";
import CommentPanel from "../components/CommentPanel.tsx";
import { formatChinaDate } from "../utils/time";

function ComicPartCover({ part }: { part: ComicPartDetailPart }) {
  const coverUrl = resolveAssetUrl(part.coverUrl);

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={part.title}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 p-3 md:p-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200 md:text-xs md:tracking-[0.22em]">
          Comic Part
        </p>

        <h2 className="mt-2 line-clamp-3 text-sm font-bold leading-5 text-white md:mt-4 md:text-xl md:leading-tight">
          {part.title}
        </h2>
      </div>

      <p className="text-xs text-blue-100 md:text-sm">暂无封面</p>
    </div>
  );
}

function ComicPartPage() {
  const { seriesSlug, partSlug } = useParams<{
    seriesSlug: string;
    partSlug: string;
  }>();

  const [detail, setDetail] = useState<ComicPartDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [canManagePart, setCanManagePart] = useState(false);

  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);

  useEffect(() => {
    async function loadPart() {
      if (!seriesSlug || !partSlug) {
        setErrorMessage("缺少漫画分部参数。");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);
        setDetail(null);
        setCanManagePart(false);

        const data = await getComicPartDetail(seriesSlug, partSlug);
        setDetail(data);

        const token = getAccessToken();

        if (!token) {
          setCanManagePart(false);
          return;
        }

        try {
          const currentUser = await getMe();
          setCanManagePart(data.part.owner?.id === currentUser.id);
        } catch {
          setCanManagePart(false);
        }
      } catch (error) {
        console.error(error);

        if (error instanceof Error) {
          if (error.message === "请求的内容不存在。") {
            setErrorMessage(null);
            return;
          }

          setErrorMessage(error.message);
        } else {
          setErrorMessage("漫画分部加载失败。");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadPart();
  }, [seriesSlug, partSlug]);

  const series = detail?.series ?? null;
  const part = detail?.part ?? null;

  useEffect(() => {
    async function loadFavoriteState() {
      if (!seriesSlug || !partSlug || !part) {
        setIsFavorited(false);
        return;
      }

      if (!getAccessToken()) {
        setIsFavorited(false);
        return;
      }

      try {
        const favoriteState = await getComicPartFavoriteState(
          seriesSlug,
          partSlug,
        );

        setIsFavorited(favoriteState.isFavorited);
      } catch {
        setIsFavorited(false);
      }
    }

    loadFavoriteState();
  }, [seriesSlug, partSlug, part]);

  const chapters = useMemo(() => {
    if (!detail) return [];

    return [...detail.chapters].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
  }, [detail]);

  async function handleToggleFavorite() {
    if (!seriesSlug || !partSlug || !part || isFavoriteLoading) {
      return;
    }

    if (!getAccessToken()) {
      setErrorMessage("请先登录后再收藏。");
      return;
    }

    try {
      setIsFavoriteLoading(true);

      const result = isFavorited
        ? await unfavoriteComicPart(seriesSlug, partSlug)
        : await favoriteComicPart(seriesSlug, partSlug);

      setIsFavorited(result.isFavorited);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "收藏操作失败。");
    } finally {
      setIsFavoriteLoading(false);
    }
  }

  return (
    <main className="page-shell min-h-[100dvh] pb-10 md:pb-16">
      <section className="mx-auto max-w-[1250px] px-4 py-6 md:px-8 md:py-8">
        <Link
          to={series ? `/works/comics/${series.slug}` : "/works/comics"}
          className="mb-4 inline-block text-sm font-semibold link-accent"
        >
          ← 返回漫画系列
        </Link>

        {isLoading && (
          <section className="border-y border-[var(--color-border-soft)] py-6 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:px-6 md:py-8 md:shadow-[var(--shadow-card)]">
            <p className="text-sm text-soft">正在加载漫画分部...</p>
          </section>
        )}

        {errorMessage && (
          <section>
            <p className="message-error p-4 text-sm">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && !part && (
          <section className="border-y border-[var(--color-border-soft)] py-6 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:px-6 md:py-8 md:shadow-[var(--shadow-card)]">
            <p className="text-sm text-soft">未找到漫画分部。</p>
          </section>
        )}

        {!isLoading && !errorMessage && series && part && (
          <section className="overflow-hidden border-y border-[var(--color-border-soft)] md:rounded-xl md:border md:bg-white md:shadow-sm">
            <header className="grid grid-cols-[86px_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-[var(--color-border-soft)] py-4 md:relative md:grid-cols-[180px_minmax(0,1fr)] md:gap-7 md:px-8 md:py-7">
              <div className="h-[120px] overflow-hidden rounded-sm border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] md:h-[250px] md:rounded-[0.65rem]">
                <ComicPartCover part={part} />
              </div>

              <div className="flex min-w-0 flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3 md:block">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] link-accent md:text-sm md:tracking-[0.22em]">
                      Comic Part
                    </p>

                    {canManagePart && (
                      <div className="shrink-0 md:absolute md:right-8 md:top-7">
                        <Link
                          to={`/creator/comics/${series.slug}/${part.slug}`}
                          className="inline-flex rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:bg-[var(--color-panel-soft-bg)] link-accent md:rounded-xl md:px-4 md:py-2 md:text-sm"
                        >
                          管理这个分部
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 md:mt-3 md:gap-x-2">
                    <h1 className="min-w-0 line-clamp-2 text-xl font-bold leading-7 text-main md:text-4xl md:leading-tight">
                      {part.title}
                    </h1>

                    <FavoriteStarButton
                      isFavorited={isFavorited}
                      isLoading={isFavoriteLoading}
                      title={
                        isFavorited ? "取消收藏这个漫画分部" : "收藏这个漫画分部"
                      }
                      onClick={handleToggleFavorite}
                    />
                  </div>

                  <p className="mt-2 hidden max-w-3xl whitespace-pre-line text-sm leading-6 text-muted md:mt-4 md:block md:text-base md:leading-7">
                    {part.summary || "暂无分部简介。"}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--color-border-soft)] pt-2 text-xs text-soft md:grid-cols-3 md:pt-4 md:text-sm">
                  <div>
                    <p className="font-semibold text-main">作者</p>
                    {part.owner ? (
                      <Link
                        to={`/users/${part.owner.username}`}
                        className="mt-0.5 block truncate transition hover:text-[var(--color-accent)] hover:underline hover:underline-offset-4 md:mt-1"
                      >
                        {part.owner.displayName || part.owner.username}
                      </Link>
                    ) : (
                      <p className="mt-0.5 md:mt-1">未设置</p>
                    )}
                  </div>

                  <div>
                    <p className="font-semibold text-main">最近更新</p>
                    <p className="mt-0.5 md:mt-1">{formatChinaDate(part.updatedAt)}</p>
                  </div>

                  <div className="hidden md:block">
                    <p className="font-semibold text-main">所属系列</p>
                    <p className="mt-1 truncate">{series.title}</p>
                  </div>
                </div>
              </div>

              <p className="col-span-2 whitespace-pre-line text-sm leading-6 text-muted md:hidden">
                {part.summary || "暂无分部简介。"}
              </p>
            </header>

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
                        to={`/works/comics/${series.slug}/${part.slug}/${chapter.slug}`}
                        className="group flex items-center justify-between gap-3 border-b border-[var(--color-border-soft)] py-3 md:py-3.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-main group-hover:text-[var(--color-accent)]">
                            {chapter.title}
                          </p>

                          <p className="mt-1 text-xs text-soft">
                            更新于 {formatChinaDate(chapter.updatedAt)}
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

                <CommentPanel
                  targetType="comic_part"
                  targetId={part.id}
                  title="评论"
                  emptyText="还没有评论。"
                />
              </aside>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default ComicPartPage;
