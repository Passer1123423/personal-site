import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getUserProfile, type PublicUserProfile } from "../api/users";

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
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <section className="mx-auto max-w-5xl">
          <p className="text-sm text-slate-400">正在加载用户信息...</p>
        </section>
      </main>
    );
  }

  if (errorMessage || !profile) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <section className="mx-auto max-w-5xl">
          <Link
            to="/"
            className="text-sm text-slate-400 transition hover:text-slate-100"
          >
            ← 返回首页
          </Link>
          <h1 className="mt-8 text-3xl font-semibold">用户不存在</h1>
          <p className="mt-3 text-sm text-slate-400">
            {errorMessage || "无法找到该用户。"}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <section className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="text-sm text-slate-400 transition hover:text-slate-100"
        >
          ← 返回首页
        </Link>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-800 text-3xl font-semibold text-slate-300">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>

            <div>
              <p className="text-sm text-slate-400">@{profile.username}</p>
              <h1 className="mt-2 text-3xl font-semibold">
                {profile.displayName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                {profile.bio || "这个用户还没有填写简介。"}
              </p>

              <div className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {profile.role}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">作品</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              暂无公开作品。
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">收藏</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              收藏功能尚未开放。
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">动态</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              动态功能尚未开放。
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}