// src/pages/CreatorComicSeriesPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getMe } from "../api/auth";
import {
  createAuthorComicPart,
  fetchAuthorComicsTree,
  type AuthorComicPart,
  type AuthorComicSeries,
} from "../api/authorComics";
import CreatorAddBookCard from "../components/creator/CreatorAddBookCard";
import CreatorBookCard from "../components/creator/CreatorBookCard";

type Message = {
  type: "success" | "error";
  text: string;
};

const desktopSectionClass =
  "md:border md:border-[var(--color-border-soft)] md:rounded-[var(--radius-card)] md:bg-[var(--color-panel-bg)] md:p-5 md:shadow-[var(--shadow-card)]";

export default function CreatorComicSeriesPage() {
  const { seriesSlug } = useParams();
  const navigate = useNavigate();

  const [seriesList, setSeriesList] = useState<AuthorComicSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);

  const [createPartOpen, setCreatePartOpen] = useState(false);
  const [newPartSlug, setNewPartSlug] = useState("");
  const [newPartTitle, setNewPartTitle] = useState("");
  const [newPartSummary, setNewPartSummary] = useState("");
  const [createPartError, setCreatePartError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadPageData() {
    setLoading(true);
    setMessage(null);

    try {
      await getMe();

      const data = await fetchAuthorComicsTree();
      setSeriesList(data);
    } catch (error: unknown) {
      const text =
        error instanceof Error ? error.message : "加载创作者 series 失败";

      if (
        text === "未登录" ||
        text.includes("Not authenticated") ||
        text.includes("401")
      ) {
        navigate("/admin/login", { replace: true });
        return;
      }

      setMessage({
        type: "error",
        text,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    if (!createPartError) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCreatePartError(null);
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [createPartError]);

  const currentSeries = useMemo(() => {
    if (!seriesSlug) {
      return null;
    }

    return seriesList.find((series) => series.slug === seriesSlug) ?? null;
  }, [seriesList, seriesSlug]);

  const sortedParts = useMemo<AuthorComicPart[]>(() => {
    if (!currentSeries) {
      return [];
    }

    return [...currentSeries.parts].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
  }, [currentSeries]);

  function handleCreatePart() {
    setNewPartSlug("");
    setNewPartTitle("");
    setNewPartSummary("");
    setCreatePartError(null);
    setCreatePartOpen(true);
  }

  async function handleSubmitCreatePart() {
    if (!seriesSlug) {
      setCreatePartError("缺少 series 参数。");
      return;
    }

    const slug = newPartSlug.trim();

    if (!slug) {
      setCreatePartError("Part slug 不能为空。");
      return;
    }

    setSubmitting(true);
    setCreatePartError(null);

    try {
      const createdPart = await createAuthorComicPart({
        seriesSlug,
        slug,
        title: newPartTitle,
        summary: newPartSummary,
      });

      setCreatePartOpen(false);
      setNewPartSlug("");
      setNewPartTitle("");
      setNewPartSummary("");
      setCreatePartError(null);

      navigate(`/creator/comics/${seriesSlug}/${createdPart.slug}`);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "新建 part 失败";
      setCreatePartError(text);
    } finally {
      setSubmitting(false);
    }
  }

  if (!seriesSlug) {
    return (
      <main className="admin-page-shell min-h-[100dvh] px-4 py-7 md:px-6 md:py-10">
        <section className="mx-auto max-w-7xl">
          <Link to="/creator/comics" className="link-accent text-sm">
            返回创作者漫画书架
          </Link>

          <div className="admin-message-error mt-5 px-4 py-3 text-sm md:mt-6">
            缺少 series 参数。
          </div>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="admin-page-shell min-h-[100dvh] px-4 py-7 md:px-6 md:py-10">
        <section className="mx-auto max-w-7xl">
          <Link to="/creator/comics" className="link-accent text-sm">
            返回创作者漫画书架
          </Link>

          <section
            className={`mt-5 border-y border-[var(--color-border-soft)] py-5 ${desktopSectionClass}`}
          >
            <p className="text-sm text-soft">正在加载 series...</p>
          </section>
        </section>
      </main>
    );
  }

  if (message) {
    return (
      <main className="admin-page-shell min-h-[100dvh] px-4 py-7 md:px-6 md:py-10">
        <section className="mx-auto max-w-7xl">
          <Link to="/creator/comics" className="link-accent text-sm">
            返回创作者漫画书架
          </Link>

          <div
            className={
              message.type === "success"
                ? "admin-message-success mt-5 px-4 py-3 text-sm md:mt-6"
                : "admin-message-error mt-5 px-4 py-3 text-sm md:mt-6"
            }
          >
            {message.text}
          </div>
        </section>
      </main>
    );
  }

  if (!currentSeries) {
    return (
      <main className="admin-page-shell min-h-[100dvh] px-4 py-7 md:px-6 md:py-10">
        <section className="mx-auto max-w-7xl">
          <Link to="/creator/comics" className="link-accent text-sm">
            返回创作者漫画书架
          </Link>

          <section
            className={`mt-5 border-y border-[var(--color-border-soft)] py-5 ${desktopSectionClass}`}
          >
            <p className="text-sm text-soft">未找到该 series。</p>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page-shell min-h-[100dvh] px-4 py-7 md:px-6 md:py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 md:mb-8 md:items-center md:gap-4">
          <div className="min-w-0">
            <Link to="/creator/comics" className="link-accent text-sm">
              返回创作者漫画书架
            </Link>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] link-accent md:text-sm md:tracking-[0.25em]">
              Creator Comic Series
            </p>

            <h1 className="mt-2 text-2xl font-bold leading-tight text-main md:text-3xl">
              {currentSeries.title}
            </h1>

            {currentSeries.summary ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:mt-4 md:leading-7">
                {currentSeries.summary}
              </p>
            ) : (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-soft md:mt-4 md:leading-7">
                暂无 series 简介。
              </p>
            )}
          </div>

          <button
            type="button"
            className="admin-button-primary px-4 py-2 text-sm font-semibold md:px-5 md:py-3"
            onClick={handleCreatePart}
          >
            新建 part
          </button>
        </div>

        <section
          className={`border-y border-[var(--color-border-soft)] py-5 ${desktopSectionClass}`}
        >
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--color-border-soft)] pb-4 md:border-b-0 md:pb-0">
            <div>
              <h2 className="text-lg font-semibold text-main md:text-xl">
                你的 part
              </h2>

              <p className="mt-1.5 text-sm leading-6 text-muted md:mt-2">
                这里只显示当前用户拥有 owner 权限的 part。进入 part 后进行章节上传和管理。
              </p>
            </div>

            <p className="text-xs text-soft md:text-sm">
              共 {sortedParts.length} 个 part
            </p>
          </div>

          {sortedParts.length > 0 ? (
            <div className="mt-6 grid grid-cols-[repeat(auto-fill,112px)] justify-center gap-x-7 gap-y-9 sm:grid-cols-[repeat(auto-fill,128px)] md:mt-8 md:justify-start md:gap-x-10 md:gap-y-12">
              {sortedParts.map((part) => (
                <CreatorBookCard
                  key={part.id}
                  title={part.title}
                  summary={part.summary}
                  coverUrl={part.coverUrl}
                  href={`/creator/comics/${currentSeries.slug}/${part.slug}`}
                  meta={`${part.chapters.length} 个 chapter`}
                />
              ))}

              <CreatorAddBookCard
                label="新建 part"
                description="创建新的漫画分部"
                onClick={handleCreatePart}
              />
            </div>
          ) : (
            <div className="mt-5 border-t border-[var(--color-border-soft)] pt-5 text-sm leading-6 text-soft md:mt-6 md:border-t-0 md:pt-0">
              你在这个 series 下还没有 part。可以先新建一个 part，再进入 part 页面上传章节。
            </div>
          )}
        </section>
      </section>

      {createPartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <section className="admin-section max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-main md:text-xl">
                  新建 part
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted">
                  在当前 series 下创建一个新的漫画 part。比如：第一部、番外篇、设定集。
                </p>

                {createPartError && (
                  <div className="admin-message-error mt-4 px-4 py-3 text-sm leading-6">
                    {createPartError}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="admin-button-secondary px-3 py-2 text-sm"
                disabled={submitting}
                onClick={() => {
                  setCreatePartError(null);
                  setCreatePartOpen(false);
                }}
              >
                关闭
              </button>
            </div>

            <div className="mt-5 space-y-4 md:mt-6">
              <div>
                <label className="text-sm font-semibold text-main">
                  Part slug
                </label>

                <input
                  className="admin-input mt-2 w-full px-4 py-2.5 md:py-3"
                  value={newPartSlug}
                  disabled={submitting}
                  onChange={(event) => {
                    setNewPartSlug(event.target.value);
                    setCreatePartError(null);
                  }}
                  placeholder="必填，例如：part-1"
                  autoFocus
                />

                <p className="mt-2 text-xs leading-5 text-soft">
                  slug 是不可更改的唯一识别码，不能和当前 series 下已有 part 重复。
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-main">
                  Part 标题
                </label>

                <input
                  className="admin-input mt-2 w-full px-4 py-2.5 md:py-3"
                  value={newPartTitle}
                  disabled={submitting}
                  onChange={(event) => setNewPartTitle(event.target.value)}
                  placeholder="选填，例如：第一部"
                />

                <p className="mt-2 text-xs leading-5 text-soft">
                  可留空。留空时后端会使用默认标题。
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-main">
                  Part 简介
                </label>

                <textarea
                  className="admin-textarea mt-2 min-h-24 w-full px-4 py-2.5 text-sm leading-6 md:min-h-28 md:py-3 md:leading-7"
                  value={newPartSummary}
                  disabled={submitting}
                  onChange={(event) => setNewPartSummary(event.target.value)}
                  placeholder="选填。之后也可以在 part 页面继续维护。"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3 md:mt-6">
              <button
                type="button"
                className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                disabled={submitting}
                onClick={() => {
                  setCreatePartError(null);
                  setCreatePartOpen(false);
                }}
              >
                取消
              </button>

              <button
                type="button"
                className="admin-button-primary px-4 py-2 text-sm font-semibold"
                disabled={submitting}
                onClick={handleSubmitCreatePart}
              >
                {submitting ? "创建中..." : "创建 part"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}