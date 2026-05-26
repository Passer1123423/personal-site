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
    <main className="admin-page-shell min-h-[100dvh] px-6 py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/creator" className="link-accent text-sm">
              返回创作中心
            </Link>

            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] link-accent">
              Creator Novels
            </p>

            <h1 className="mt-2 text-3xl font-bold text-main">
              创作者小说书架
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              这里展示 owner 为你的小说。进入小说后可以管理封面、简介和章节。
            </p>
          </div>

          <button
            type="button"
            className="admin-button-primary px-5 py-3 text-sm font-semibold"
            onClick={handleCreateNovel}
          >
            新建 novel
          </button>
        </div>

        {message && (
          <div
            className={
              message.type === "success"
                ? "admin-message-success mb-6 px-4 py-3"
                : "admin-message-error mb-6 px-4 py-3"
            }
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <section className="admin-section">
            <p className="text-sm text-soft">正在加载 novel 书架...</p>
          </section>
        ) : (
          <section className="admin-section">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-main">我的小说</h2>
                <p className="mt-2 text-sm text-muted">
                  选择一本小说后进入章节管理。
                </p>
              </div>

              <p className="text-sm text-soft">共 {novels.length} 本 novel</p>
            </div>

            <div className="mt-8 grid grid-cols-[repeat(auto-fill,112px)] justify-center gap-x-10 gap-y-12 sm:grid-cols-[repeat(auto-fill,128px)] md:justify-start">
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
          <section className="admin-section w-full max-w-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-main">
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

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-main">
                  Novel slug
                </label>

                <input
                  className="admin-input mt-2 w-full px-4 py-3"
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
                  className="admin-input mt-2 w-full px-4 py-3"
                  value={newNovelTitle}
                  disabled={submitting}
                  onChange={(event) => setNewNovelTitle(event.target.value)}
                  placeholder="选填。留空时后端会使用默认标题。"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
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
