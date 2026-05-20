// src/pages/CreatorComicsPage.tsx

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getMe } from "../api/auth";
import {
  fetchAuthorComicsTree,
  type AuthorComicSeries,
} from "../api/authorComics";
import CreatorAddBookCard from "../components/creator/CreatorAddBookCard";
import CreatorBookCard from "../components/creator/CreatorBookCard";

type Message = {
  type: "success" | "error";
  text: string;
};

export default function CreatorComicsPage() {
  const navigate = useNavigate();

  const [seriesList, setSeriesList] = useState<AuthorComicSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);

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

  function handleCreateSeries() {
    setMessage({
      type: "error",
      text: "新建 series 弹窗还没有接入。下一步处理。",
    });
  }

  return (
    <main className="admin-page-shell min-h-[100dvh] px-6 py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/works" className="link-accent text-sm">
              返回作品页
            </Link>

            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] link-accent">
              Creator Comics
            </p>

            <h1 className="mt-2 text-3xl font-bold text-main">
              创作者漫画书架
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              这里展示全站 series。series 本身不归属作者，进入某个 series 后再显示当前用户拥有 owner 权限的 part。
            </p>
          </div>

          <button
            type="button"
            className="admin-button-primary px-5 py-3 text-sm font-semibold"
            onClick={handleCreateSeries}
          >
            新建 series
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
            <p className="text-sm text-soft">正在加载 series 书架...</p>
          </section>
        ) : (
          <section className="admin-section">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-main">
                  全站 series
                </h2>
                <p className="mt-2 text-sm text-muted">
                  选择一个 series 后，进入该 series 下属于你的 part 书架。
                </p>
              </div>

              <p className="text-sm text-soft">
                共 {seriesList.length} 个 series
              </p>
            </div>

            <div className="mt-8 grid grid-cols-[repeat(auto-fill,112px)] justify-center gap-x-10 gap-y-12 sm:grid-cols-[repeat(auto-fill,128px)] md:justify-start">
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
    </main>
  );
}