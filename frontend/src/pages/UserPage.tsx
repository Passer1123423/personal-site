import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getUserProfile, type PublicUserProfile } from "../api/users";
import CommentPanel from "../components/CommentPanel";

export default function UserPage() {
  const { username } = useParams();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!username) {
        setErrorMessage("用户参数缺失");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const data = await getUserProfile(username);
        setProfile(data);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "加载用户失败");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [username]);

  if (isLoading) {
    return (
      <main className="page-shell px-6 py-12">
        <section className="mx-auto max-w-5xl">
          <p className="text-sm text-soft">正在加载用户信息...</p>
        </section>
      </main>
    );
  }

  if (errorMessage || !profile) {
    return (
      <main className="page-shell px-6 py-12">
        <section className="mx-auto max-w-5xl">
          <Link
            to="/"
            className="text-sm link-accent transition"
          >
            ← 返回首页
          </Link>
          <h1 className="mt-8 text-3xl font-semibold text-main">用户不存在</h1>
          <p className="mt-3 text-sm text-soft">
            {errorMessage || "无法找到该用户。"}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell px-6 py-12">
      <section className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="text-sm link-accent transition"
        >
          ← 返回首页
        </Link>

        <section className="surface-card mt-8 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="badge-accent flex h-24 w-24 items-center justify-center text-3xl font-semibold">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>

            <div>
              <p className="text-sm text-soft">@{profile.username}</p>
              <h1 className="mt-2 text-3xl font-semibold text-main">
                {profile.displayName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                {profile.bio || "这个用户还没有填写简介。"}
              </p>

              {profile.role === "admin" ? (
                <Link
                  to="/admin"
                  className="badge-accent mt-4 inline-flex px-3 py-1 text-xs"
                >
                  {profile.role}
                </Link>
              ) : (
                <div className="badge-accent mt-4 inline-flex px-3 py-1 text-xs">
                  {profile.role}
                </div>
              )}

            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-main">作品</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              暂无公开作品。
            </p>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-main">收藏</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              收藏功能尚未开放。
            </p>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-main">动态</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              动态功能尚未开放。
            </p>
          </div>
        </section>

        <section className="surface-card mt-8 p-6 max-sm:p-4">
          <CommentPanel
            targetType="user_page"
            targetId={profile.id}
            title="留言"
            emptyText="还没有留言。"
          />
        </section>
      </section>
    </main>
  );
}
