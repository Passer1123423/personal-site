import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getMe } from "../api/auth";
import {
  createAuthorNovel,
  fetchAuthorNovelsTree,
  type AuthorNovel,
} from "../api/authorNovels";
import CreatorAddBookCard from "../components/creator/CreatorAddBookCard";
import CreatorBookCard from "../components/creator/CreatorBookCard";

type Message = {
  type: "success" | "error";
  text: string;
};

export default function CreatorNovelsPage() {
  const navigate = useNavigate();

  const [novels, setNovels] = useState<AuthorNovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newNovelSlug, setNewNovelSlug] = useState("");
  const [newNovelTitle, setNewNovelTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadPageData() {
    setLoading(true);
    setMessage(null);

    try {
      await getMe();

      const data = await fetchAuthorNovelsTree();
      setNovels(data);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "加载小说书架失败";

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

  function handleCreateNovel() {
    setNewNovelSlug("");
    setNewNovelTitle("");
    setCreateError(null);
    setCreateOpen(true);
  }

  async function handleSubmitCreateNovel() {
    const slug = newNovelSlug.trim();

    if (!slug) {
      setCreateError("Novel slug 不能为空。");
      return;
    }

    setSubmitting(true);
    setCreateError(null);

    try {
      const createdNovel = await createAuthorNovel({
        slug,
        title: newNovelTitle,
      });

      setCreateOpen(false);
      setNewNovelSlug("");
      setNewNovelTitle("");
      navigate(`/creator/novels/${createdNovel.slug}`);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "新建 novel 失败";
      setCreateError(text);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-page-shell min-h-[100dvh] px-4 py-7 md:px-6 md:py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 md:mb-8 md:items-center md:gap-4">
          <div className="min-w-0">
            <Link to="/creator" className="link-accent text-sm">
              返回创作中心
            </Link>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] link-accent md:text-sm md:tracking-[0.25em]">
              Creator Novels
            </p>

            <h1 className="mt-2 text-2xl font-bold leading-tight text-main md:text-3xl">
              创作者小说书架
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:mt-4 md:leading-7">
              这里展示 owner 为你的小说。进入小说后可以管理封面、简介和章节。
            </p>
          </div>

          <button
            type="button"
            className="admin-button-primary px-4 py-2 text-sm font-semibold md:px-5 md:py-3"
            onClick={handleCreateNovel}
          >
            新建 novel
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
          <section className="border-y border-[var(--color-border-soft)] py-5 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:p-5 md:shadow-[var(--shadow-card)]">
            <p className="text-sm text-soft">正在加载 novel 书架...</p>
          </section>
        ) : (
          <section className="border-y border-[var(--color-border-soft)] py-5 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:p-5 md:shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--color-border-soft)] pb-4 md:gap-3 md:border-b-0 md:pb-0">
              <div>
                <h2 className="text-lg font-semibold text-main md:text-xl">
                  我的小说
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-muted md:mt-2">
                  选择一本小说后进入章节管理。
                </p>
              </div>

              <p className="text-xs text-soft md:text-sm">
                共 {novels.length} 本 novel
              </p>
            </div>

            <div className="mt-6 grid grid-cols-[repeat(auto-fill,96px)] justify-center gap-x-5 gap-y-7 sm:grid-cols-[repeat(auto-fill,128px)] sm:gap-x-7 sm:gap-y-9 md:mt-8 md:justify-start md:gap-x-10 md:gap-y-12">
              {novels.map((novel) => (
                <CreatorBookCard
                  key={novel.id}
                  title={novel.title}
                  summary={novel.summary}
                  coverUrl={novel.coverUrl}
                  href={`/creator/novels/${novel.slug}`}
                  meta={`${novel.chapters.length} 个 chapter`}
                />
              ))}

              <CreatorAddBookCard
                label="新建 novel"
                description="创建新的小说"
                onClick={handleCreateNovel}
              />
            </div>
          </section>
        )}
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <section className="admin-section max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-main md:text-xl">
                  新建 novel
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted">
                  创建一本新的小说。创建后会自动归属当前账号。
                </p>

                {createError && (
                  <div className="admin-message-error mt-4 px-4 py-3 text-sm leading-6">
                    {createError}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="admin-button-secondary px-3 py-2 text-sm"
                disabled={submitting}
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(false);
                }}
              >
                关闭
              </button>
            </div>

            <div className="mt-5 space-y-4 md:mt-6">
              <div>
                <label className="text-sm font-semibold text-main">
                  Novel slug
                </label>

                <input
                  className="admin-input mt-2 w-full px-4 py-2.5 md:py-3"
                  value={newNovelSlug}
                  disabled={submitting}
                  onChange={(event) => {
                    setNewNovelSlug(event.target.value);
                    setCreateError(null);
                  }}
                  placeholder="必填，例如：my-first-novel"
                  autoFocus
                />

                <p className="mt-2 text-xs leading-5 text-soft">
                  slug 是不可更改的唯一识别码，不能和已有 novel 重复。
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-main">
                  Novel 标题
                </label>

                <input
                  className="admin-input mt-2 w-full px-4 py-2.5 md:py-3"
                  value={newNovelTitle}
                  disabled={submitting}
                  onChange={(event) => setNewNovelTitle(event.target.value)}
                  placeholder="选填。留空时后端会使用默认标题。"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3 md:mt-6">
              <button
                type="button"
                className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                disabled={submitting}
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(false);
                }}
              >
                取消
              </button>

              <button
                type="button"
                className="admin-button-primary px-4 py-2 text-sm font-semibold"
                disabled={submitting}
                onClick={handleSubmitCreateNovel}
              >
                {submitting ? "创建中..." : "创建 novel"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}