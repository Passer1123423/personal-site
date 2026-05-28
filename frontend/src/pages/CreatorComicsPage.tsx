// src/pages/CreatorComicsPage.tsx

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getMe } from "../api/auth";
import {
  createAuthorComicSeries,
  fetchAuthorComicsTree,
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

export default function CreatorComicsPage() {
  const navigate = useNavigate();

  const [seriesList, setSeriesList] = useState<AuthorComicSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);

  const [createSeriesOpen, setCreateSeriesOpen] = useState(false);
  const [newSeriesSlug, setNewSeriesSlug] = useState("");
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [newSeriesSummary, setNewSeriesSummary] = useState("");
  const [createSeriesError, setCreateSeriesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadPageData() {
    setLoading(true);
    setMessage(null);

    try {
      await getMe();

      const data = await fetchAuthorComicsTree();
      setSeriesList(data);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "加载创作者书架失败";

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
    if (!createSeriesError) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCreateSeriesError(null);
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [createSeriesError]);

  function handleCreateSeries() {
    setNewSeriesSlug("");
    setNewSeriesTitle("");
    setNewSeriesSummary("");
    setCreateSeriesError(null);
    setCreateSeriesOpen(true);
  }

  async function handleSubmitCreateSeries() {
    const slug = newSeriesSlug.trim();

    if (!slug) {
      setCreateSeriesError("Series slug 不能为空。");
      return;
    }

    setSubmitting(true);
    setCreateSeriesError(null);

    try {
      const createdSeries = await createAuthorComicSeries({
        slug,
        title: newSeriesTitle,
        summary: newSeriesSummary,
      });

      setCreateSeriesOpen(false);
      setNewSeriesSlug("");
      setNewSeriesTitle("");
      setNewSeriesSummary("");
      setCreateSeriesError(null);

      navigate(`/creator/comics/${createdSeries.slug}`);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "新建 series 失败";
      setCreateSeriesError(text);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-page-shell min-h-[100dvh] px-4 py-7 md:px-6 md:py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 md:mb-8 md:items-center md:gap-4">
          <div className="min-w-0">
            <Link to="/works" className="link-accent text-sm">
              返回作品页
            </Link>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] link-accent md:text-sm md:tracking-[0.25em]">
              Creator Comics
            </p>

            <h1 className="mt-2 text-2xl font-bold leading-tight text-main md:text-3xl">
              创作者漫画书架
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:mt-4 md:leading-7">
              这里展示全站 series。series 本身不归属作者，进入某个 series 后再显示当前用户拥有 owner 权限的 part。
            </p>
          </div>

          <button
            type="button"
            className="admin-button-primary px-4 py-2 text-sm font-semibold md:px-5 md:py-3"
            onClick={handleCreateSeries}
          >
            新建 series
          </button>
        </div>

        {message && (
          <div
            className={
              message.type === "success"
                ? "admin-message-success mb-5 px-4 py-3 text-sm md:mb-6"
                : "admin-message-error mb-5 px-4 py-3 text-sm md:mb-6"
            }
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <section
            className={`border-y border-[var(--color-border-soft)] py-5 ${desktopSectionClass}`}
          >
            <p className="text-sm text-soft">正在加载 series 书架...</p>
          </section>
        ) : (
          <section
            className={`border-y border-[var(--color-border-soft)] py-5 ${desktopSectionClass}`}
          >
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--color-border-soft)] pb-4 md:border-b-0 md:pb-0">
              <div>
                <h2 className="text-lg font-semibold text-main md:text-xl">
                  全站 series
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-muted md:mt-2">
                  选择一个 series 后，进入该 series 下属于你的 part 书架。
                </p>
              </div>

              <p className="text-xs text-soft md:text-sm">
                共 {seriesList.length} 个 series
              </p>
            </div>

            <div className="mt-6 grid grid-cols-[repeat(auto-fill,112px)] justify-center gap-x-7 gap-y-9 sm:grid-cols-[repeat(auto-fill,128px)] md:mt-8 md:justify-start md:gap-x-10 md:gap-y-12">
              {seriesList.map((series) => (
                <CreatorBookCard
                  key={series.id}
                  title={series.title}
                  summary={series.summary}
                  coverUrl={series.coverUrl}
                  href={`/creator/comics/${series.slug}`}
                  meta={`${series.parts.length} 个 part`}
                />
              ))}

              <CreatorAddBookCard
                label="新建 series"
                description="创建新的漫画系列"
                onClick={handleCreateSeries}
              />
            </div>
          </section>
        )}
      </section>

      {createSeriesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <section className="admin-section max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-main md:text-xl">
                  新建 series
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted">
                  创建一个新的漫画 series。比如：SaBa帮的历史第一季。
                </p>

                {createSeriesError && (
                  <div className="admin-message-error mt-4 px-4 py-3 text-sm leading-6">
                    {createSeriesError}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="admin-button-secondary px-3 py-2 text-sm"
                disabled={submitting}
                onClick={() => {
                  setCreateSeriesError(null);
                  setCreateSeriesOpen(false);
                }}
              >
                关闭
              </button>
            </div>

            <div className="mt-5 space-y-4 md:mt-6">
              <div>
                <label className="text-sm font-semibold text-main">
                  Series slug
                </label>

                <input
                  className="admin-input mt-2 w-full px-4 py-2.5 md:py-3"
                  value={newSeriesSlug}
                  disabled={submitting}
                  onChange={(event) => {
                    setNewSeriesSlug(event.target.value);
                    setCreateSeriesError(null);
                  }}
                  placeholder="必填，例如：my-comic-series"
                  autoFocus
                />

                <p className="mt-2 text-xs leading-5 text-soft">
                  slug 是不可更改的唯一识别码，不能和已有 series 重复。
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-main">
                  Series 标题
                </label>

                <input
                  className="admin-input mt-2 w-full px-4 py-2.5 md:py-3"
                  value={newSeriesTitle}
                  disabled={submitting}
                  onChange={(event) => setNewSeriesTitle(event.target.value)}
                  placeholder="选填，例如：鸡神漫画集"
                />

                <p className="mt-2 text-xs leading-5 text-soft">
                  可留空。留空时后端会使用默认标题。
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-main">
                  Series 简介
                </label>

                <textarea
                  className="admin-textarea mt-2 min-h-24 w-full px-4 py-2.5 text-sm leading-6 md:min-h-28 md:py-3 md:leading-7"
                  value={newSeriesSummary}
                  disabled={submitting}
                  onChange={(event) => setNewSeriesSummary(event.target.value)}
                  placeholder="选填。之后也可以在 series 页面修改。"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3 md:mt-6">
              <button
                type="button"
                className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                disabled={submitting}
                onClick={() => {
                  setCreateSeriesError(null);
                  setCreateSeriesOpen(false);
                }}
              >
                取消
              </button>

              <button
                type="button"
                className="admin-button-primary px-4 py-2 text-sm font-semibold"
                disabled={submitting}
                onClick={handleSubmitCreateSeries}
              >
                {submitting ? "创建中..." : "创建 series"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}