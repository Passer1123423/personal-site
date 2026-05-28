import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getMe } from "../api/auth";
import {
  createAuthorComicPart,
  fetchAuthorComicsTree,
  renameAuthorComicSeries,
  updateAuthorSeriesSummary,
  uploadAuthorSeriesCover,
  type AuthorComicSeries,
  type AuthorComicPart,
} from "../api/authorComics";
import CreatorAddBookCard from "../components/creator/CreatorAddBookCard";
import CreatorBookCard from "../components/creator/CreatorBookCard";

import { API_BASE_URL } from "../api/config";

type Message = {
  type: "success" | "error";
  text: string;
};

function resolveCoverUrl(coverUrl?: string | null) {
  if (!coverUrl) {
    return null;
  }

  if (coverUrl.startsWith("http://") || coverUrl.startsWith("https://")) {
    return coverUrl;
  }

  return `${API_BASE_URL}${coverUrl}`;
}

export default function CreatorComicSeriesPage() {
  const { seriesSlug } = useParams();
  const navigate = useNavigate();

  const [series, setSeries] = useState<AuthorComicSeries | null>(null);
  const [parts, setParts] = useState<AuthorComicPart[]>([]);

  const [seriesTitleDraft, setSeriesTitleDraft] = useState("");
  const [seriesSummaryDraft, setSeriesSummaryDraft] = useState("");
  const [isTitleEditing, setIsTitleEditing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const [createPartOpen, setCreatePartOpen] = useState(false);
  const [newPartSlug, setNewPartSlug] = useState("");
  const [newPartTitle, setNewPartTitle] = useState("");
  const [newPartSummary, setNewPartSummary] = useState("");

  const [createPartError, setCreatePartError] = useState<string | null>(null);

  async function loadPageData() {
    if (!seriesSlug) {
      setMessage({
        type: "error",
        text: "当前路由缺少 seriesSlug。",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const user = await getMe();

      const tree = await fetchAuthorComicsTree();
      const targetSeries = tree.find((item) => item.slug === seriesSlug);

      if (!targetSeries) {
        throw new Error(`未找到 series：${seriesSlug}`);
      }

      const ownedParts = targetSeries.parts.filter(
        (part) => part.owner?.id === user.id,
      );

      setSeries(targetSeries);
      setParts(ownedParts);
      setSeriesTitleDraft(targetSeries.title);
      setSeriesSummaryDraft(targetSeries.summary ?? "");
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "加载 series 失败";

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
  }, [seriesSlug]);

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

  async function handleSaveSeriesTitle() {
    if (!seriesSlug) {
      return;
    }

    const title = seriesTitleDraft.trim();

    if (!title) {
      setMessage({
        type: "error",
        text: "Series 标题不能为空。",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await renameAuthorComicSeries({
        seriesSlug,
        title,
      });

      await loadPageData();
      setIsTitleEditing(false);

      setMessage({
        type: "success",
        text: "Series 标题已更新。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Series 重命名失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveSeriesSummary() {
    if (!seriesSlug) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await updateAuthorSeriesSummary({
        seriesSlug,
        summary: seriesSummaryDraft,
      });

      await loadPageData();

      setMessage({
        type: "success",
        text: "Series 简介已保存。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Series 简介保存失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadSeriesCover(file: File | null | undefined) {
    if (!file || !seriesSlug) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await uploadAuthorSeriesCover({
        seriesSlug,
        file,
      });

      await loadPageData();

      setMessage({
        type: "success",
        text: "Series 封面已更新。",
      });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Series 封面上传失败";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  function handleCreatePart() {
    setNewPartSlug("");
    setNewPartTitle("");
    setNewPartSummary("");
    setCreatePartError(null);
    setCreatePartOpen(true);
  }

  async function handleSubmitCreatePart() {
    if (!seriesSlug) {
      setCreatePartError(" 当前路由缺少 seriesSlug。");
      return;
    }

    const slug = newPartSlug.trim();

    if (!slug) {
      setCreatePartError(" Part slug 不能为空。");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setCreatePartError(null);

    try {
      const createdPart = await createAuthorComicPart({
        seriesSlug,
        slug,
        title: newPartTitle,
        summary: newPartSummary,
      });

      await loadPageData();

      setCreatePartError(null);
      setCreatePartOpen(false);
      setNewPartSlug("");
      setNewPartTitle("");
      setNewPartSummary("");

      setMessage({
        type: "success",
        text: "Part 已新建。",
      });

      navigate(`/creator/comics/${seriesSlug}/${createdPart.slug}`);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : " 新建 part 失败";
      setCreatePartError(text);
    } finally {
      setSubmitting(false);
    }
  }

  const resolvedCoverUrl = resolveCoverUrl(series?.coverUrl);

  return (
    <main className="admin-page-shell min-h-[100dvh] px-6 py-10 max-md:px-4 max-md:py-7">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 max-md:mb-5">
          <Link to="/creator/comics" className="link-accent text-sm">
            返回创作者漫画书架
          </Link>

          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] link-accent max-md:text-xs max-md:tracking-[0.2em]">
            Creator Comics
          </p>
        </div>

        {message && (
          <div
            className={
              message.type === "success"
                ? "admin-message-success mb-6 px-4 py-3 max-md:mb-5 max-md:text-sm"
                : "admin-message-error mb-6 px-4 py-3 max-md:mb-5 max-md:text-sm"
            }
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <section className="admin-section max-md:rounded-none max-md:border-x-0 max-md:px-0 max-md:py-5 max-md:shadow-none">
            <p className="text-sm text-soft">正在加载 series...</p>
          </section>
        ) : !series ? (
          <section className="admin-section max-md:rounded-none max-md:border-x-0 max-md:px-0 max-md:py-5 max-md:shadow-none">
            <p className="text-sm text-soft">未找到目标 series。</p>
          </section>
        ) : (
          <>
            <section className="admin-section max-md:rounded-none max-md:border-x-0 max-md:px-0 max-md:py-5 max-md:shadow-none">
              <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)] max-md:grid-cols-[92px_minmax(0,1fr)] max-md:gap-x-4 max-md:gap-y-4">
                <label className="group relative flex h-60 cursor-pointer items-center justify-center overflow-hidden border border-dashed border-[var(--color-border-control)] bg-[var(--color-panel-soft-bg)] text-sm text-soft max-md:h-32 max-md:rounded-sm max-md:text-xs">
                  {resolvedCoverUrl ? (
                    <img
                      src={resolvedCoverUrl}
                      alt={series.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "Series 封面"
                  )}

                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-semibold text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 max-md:px-2 max-md:text-center max-md:text-xs">
                    点击更换封面
                  </div>

                  <input
                    className="hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={submitting}
                    onChange={(event) => {
                      handleUploadSeriesCover(event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>

                <div className="max-md:min-w-0">
                  <div className="flex flex-wrap items-center gap-3 max-md:gap-2">
                    {isTitleEditing ? (
                      <>
                        <input
                          className="admin-input px-3 py-2 text-lg font-semibold max-md:min-w-0 max-md:flex-1 max-md:text-base"
                          value={seriesTitleDraft}
                          disabled={submitting}
                          onChange={(event) =>
                            setSeriesTitleDraft(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              handleSaveSeriesTitle();
                            }

                            if (event.key === "Escape") {
                              setSeriesTitleDraft(series.title);
                              setIsTitleEditing(false);
                            }
                          }}
                          autoFocus
                        />

                        <button
                          type="button"
                          className="admin-button-secondary px-3 py-2 text-sm"
                          disabled={submitting}
                          onClick={handleSaveSeriesTitle}
                        >
                          保存
                        </button>

                        <button
                          type="button"
                          className="admin-button-danger px-3 py-2 text-sm"
                          disabled={submitting}
                          onClick={() => {
                            setSeriesTitleDraft(series.title);
                            setIsTitleEditing(false);
                          }}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="group inline-flex items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60 max-md:min-w-0 max-md:gap-2"
                        disabled={submitting}
                        title="编辑 series 标题"
                        onClick={() => {
                          setSeriesTitleDraft(series.title);
                          setIsTitleEditing(true);
                        }}
                      >
                        <h1 className="text-3xl font-bold text-main group-hover:underline group-hover:underline-offset-4 max-md:line-clamp-2 max-md:text-lg max-md:leading-6">
                          {series.title}
                        </h1>

                        <span className="admin-button-secondary px-3 py-1 text-sm group-hover:text-muted max-md:px-2 max-md:text-xs">
                          ✎
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="mt-4 max-md:mt-3 max-md:text-xs max-md:leading-5">
                    <p className="text-soft">{series.slug}</p>
                    <p className="mt-1 text-soft">{parts.length} 个 part</p>
                  </div>

                  <div className="mt-4 max-md:hidden">
                    <label className="text-sm font-semibold text-main">
                      Series 简介
                    </label>

                    <textarea
                      className="admin-textarea mt-2 min-h-28 w-full px-4 py-3 text-sm leading-7"
                      value={seriesSummaryDraft}
                      disabled={submitting}
                      onChange={(event) =>
                        setSeriesSummaryDraft(event.target.value)
                      }
                      placeholder="填写这个 series 的简介。"
                    />

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                        disabled={submitting}
                        onClick={handleSaveSeriesSummary}
                      >
                        保存简介
                      </button>
                    </div>
                  </div>
                </div>

                <div className="hidden max-md:col-span-2 max-md:block">
                  <label className="text-sm font-semibold text-main">
                    Series 简介
                  </label>

                  <textarea
                    className="admin-textarea mt-2 min-h-24 w-full px-3 py-2.5 text-sm leading-6"
                    value={seriesSummaryDraft}
                    disabled={submitting}
                    onChange={(event) =>
                      setSeriesSummaryDraft(event.target.value)
                    }
                    placeholder="填写这个 series 的简介。"
                  />

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                      disabled={submitting}
                      onClick={handleSaveSeriesSummary}
                    >
                      保存简介
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="admin-section mt-6 max-md:rounded-none max-md:border-x-0 max-md:px-0 max-md:py-5 max-md:shadow-none">
              <div className="flex flex-wrap items-end justify-between gap-3 max-md:gap-2 max-md:border-b max-md:border-[var(--color-border-soft)] max-md:pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-main max-md:text-lg">
                    我的 part 书架
                  </h2>

                  <p className="mt-2 text-sm text-muted max-md:mt-1.5 max-md:leading-6">
                    这里只展示当前登录用户拥有 owner 权限的 part。
                  </p>
                </div>

                <p className="text-sm text-soft max-md:text-xs">
                  共 {parts.length} 个 part
                </p>
              </div>

              <div className="mt-8 grid grid-cols-[repeat(auto-fill,112px)] justify-center gap-x-10 gap-y-12 sm:grid-cols-[repeat(auto-fill,128px)] md:justify-start max-md:mt-6 max-md:grid-cols-[repeat(auto-fill,96px)] max-md:gap-x-5 max-md:gap-y-7">
                {parts.map((part) => (
                  <CreatorBookCard
                    key={part.id}
                    title={part.title}
                    summary={part.summary}
                    coverUrl={part.coverUrl}
                    href={`/creator/comics/${series.slug}/${part.slug}`}
                    meta={`${part.chapters.length} 个 chapter`}
                  />
                ))}

                <CreatorAddBookCard
                  label="新建 part"
                  description="在当前 series 下创建新的 part"
                  onClick={handleCreatePart}
                />
              </div>
            </section>
          </>
        )}
      </section>

      {createPartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <section className="admin-section w-full max-w-xl max-md:max-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-main max-md:text-lg">
                  新建 part
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted">
                  在当前 series 下创建新的 part。创建后会自动把当前登录用户设为作者。
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

            <div className="mt-6 space-y-4 max-md:mt-5">
              <div>
                <label className="text-sm font-semibold text-main">
                  Part slug
                </label>

                <input
                  className="admin-input mt-2 w-full px-4 py-3 max-md:py-2.5"
                  value={newPartSlug}
                  disabled={submitting}
                  onChange={(event) => setNewPartSlug(event.target.value)}
                  placeholder="必填，例如：part-1"
                  autoFocus
                />

                <p className="mt-2 text-xs leading-5 text-soft">
                  slug 是不可更改的唯一识别码。同一 series 下不能重复。
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-main">
                  Part 标题
                </label>

                <input
                  className="admin-input mt-2 w-full px-4 py-3 max-md:py-2.5"
                  value={newPartTitle}
                  disabled={submitting}
                  onChange={(event) => setNewPartTitle(event.target.value)}
                  placeholder="选填，例如：序章"
                />

                <p className="mt-2 text-xs leading-5 text-soft">
                  可留空。后端会按顺序生成“第N章”，这里填写的是标题后缀。
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-main">
                  Part 简介
                </label>

                <textarea
                  className="admin-textarea mt-2 min-h-28 w-full px-4 py-3 text-sm leading-7 max-md:min-h-24 max-md:py-2.5 max-md:leading-6"
                  value={newPartSummary}
                  disabled={submitting}
                  onChange={(event) => setNewPartSummary(event.target.value)}
                  placeholder="选填。之后也可以在 part 页面修改。"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3 max-md:mt-5">
              <button
                type="button"
                className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                disabled={submitting}
                onClick={() => setCreatePartOpen(false)}
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
