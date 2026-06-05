import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMe, type AuthUser } from "../api/auth";
import { getUserProfile, type PublicUserProfile } from "../api/users";
import { resolveAssetUrl } from "../api/userProfile";
import CommentPanel from "../components/CommentPanel";

function getInitial(name: string | null | undefined) {
  const value = (name || "").trim();

  if (!value) {
    return "?";
  }

  return value.slice(0, 1).toUpperCase();
}

function UserAvatar({ profile }: { profile: PublicUserProfile }) {
  const avatarUrl = resolveAssetUrl(profile.avatarUrl);

  if (avatarUrl) {
    return (
      <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-orange-200 bg-white/70 shadow-[0_18px_44px_rgba(154,52,18,0.22)]">
        <img
          src={avatarUrl}
          alt={profile.displayName}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 rounded-full ring-4 ring-yellow-200/40" />
      </div>
    );
  }

  return (
    <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-orange-200 bg-gradient-to-br from-orange-100 via-yellow-50 to-white text-4xl font-black text-orange-600 shadow-[0_18px_44px_rgba(154,52,18,0.2)]">
      {getInitial(profile.displayName)}
      <div className="pointer-events-none absolute -right-2 -top-2 rounded-full bg-orange-500 px-2 py-1 text-xs font-black text-white">
        SaBa
      </div>
    </div>
  );
}

export default function UserPage() {
  const { username } = useParams();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const data = await getMe();
        setCurrentUser(data);
      } catch {
        setCurrentUser(null);
      }
    }

    loadCurrentUser();

    function handleAuthChanged() {
      loadCurrentUser();
    }

    window.addEventListener("auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChanged);
    };
  }, []);

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
      <main className="relative min-h-[70vh] overflow-hidden px-6 py-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.28),transparent_36%),linear-gradient(135deg,#fff7ed,#fffbeb)]" />

        <section className="mx-auto max-w-5xl rounded-[2rem] border border-orange-200 bg-white/75 p-8 shadow-[0_24px_70px_rgba(154,52,18,0.12)]">
          <p className="text-sm font-bold text-orange-700">
            正在从蓬莱仙岛用户名册中检索岛民信息...
          </p>
        </section>
      </main>
    );
  }

  if (errorMessage || !profile) {
    return (
      <main className="relative min-h-[70vh] overflow-hidden px-6 py-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(135deg,#fff7ed,#ffedd5)]" />

        <section className="mx-auto max-w-5xl rounded-[2rem] border border-orange-200 bg-white/80 p-8 shadow-[0_24px_70px_rgba(154,52,18,0.12)]">
          <Link to="/" className="text-sm font-bold text-orange-600 transition hover:text-orange-700">
            ← 返回首页
          </Link>

          <h1 className="mt-8 text-3xl font-black text-main">
            岛民不存在
          </h1>

          <p className="mt-3 text-sm text-soft">
            {errorMessage || "无法找到该用户。可能此人尚未获得蓬莱仙岛通行证。"}
          </p>

          <div className="mt-8 max-w-xs">
            <img
              src="/images/chickenGOD-cover.webp"
              alt=""
              className="w-full object-contain opacity-80"
              decoding="async"
            />
          </div>
        </section>
      </main>
    );
  }

  const isOwnPage = currentUser?.username === profile.username;

  return (
    <main className="relative overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.32),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.2),transparent_36%),linear-gradient(135deg,#fff7ed,#fffbeb)]" />
      <div className="pointer-events-none absolute -right-16 top-20 hidden h-80 w-80 opacity-10 md:block">
        <img
          src="/images/chickenGOD-cover.webp"
          alt=""
          className="h-full w-full object-contain"
          decoding="async"
        />
      </div>

      <section className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="inline-flex rounded-full border border-orange-200 bg-white/75 px-4 py-2 text-sm font-bold text-orange-700 shadow-[0_10px_30px_rgba(154,52,18,0.08)] transition hover:-translate-y-0.5 hover:bg-orange-50"
        >
          ← 返回蓬莱仙岛入口
        </Link>

        <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-orange-200 bg-white/78 p-6 shadow-[0_24px_70px_rgba(154,52,18,0.14)] backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-300/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-orange-300/20 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center">
            <UserAvatar profile={profile} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-bold text-orange-700">
                  @{profile.username}
                </p>

                <p className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-yellow-700">
                  SaBa Islander
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-3xl font-black tracking-tight text-main md:text-5xl">
                  {profile.displayName}
                </h1>

                {isOwnPage && (
                  <Link
                    to="/settings/profile"
                    className="inline-flex items-center justify-center rounded-full border border-orange-300 bg-orange-500 px-5 py-2 text-sm font-black text-white shadow-[0_12px_30px_rgba(234,88,12,0.22)] transition hover:-translate-y-0.5 hover:bg-orange-600"
                  >
                    编辑节日名片
                  </Link>
                )}
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted md:text-base md:leading-8">
                {profile.bio ||
                  "这个用户还没有填写简介。SaBa 节限定解释：此人保持神秘，是蓬莱仙岛低调岛民。"}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {profile.role === "admin" ? (
                  <Link
                    to="/admin"
                    className="inline-flex rounded-full border border-orange-300 bg-orange-100 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-orange-800 transition hover:bg-orange-200"
                  >
                    鸡神后台祭司 · {profile.role}
                  </Link>
                ) : (
                  <div className="inline-flex rounded-full border border-orange-300 bg-orange-100 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-orange-800">
                    岛民身份 · {profile.role}
                  </div>
                )}

                <div className="inline-flex rounded-full border border-yellow-300 bg-yellow-100 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-800">
                  SaBa 节通行证有效
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-[2rem] border border-orange-200 bg-gradient-to-br from-white to-orange-50 p-6 shadow-[0_16px_42px_rgba(154,52,18,0.1)]">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-orange-200/45 blur-2xl" />
            <h2 className="relative text-lg font-black text-main">
              作品贡品
            </h2>
            <p className="relative mt-3 text-sm leading-6 text-muted">
              暂无公开作品。SaBa 节限定说明：贡品正在打包上岛。
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-yellow-200 bg-gradient-to-br from-white to-yellow-50 p-6 shadow-[0_16px_42px_rgba(154,52,18,0.1)]">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-yellow-200/55 blur-2xl" />
            <h2 className="relative text-lg font-black text-main">
              收藏宝库
            </h2>
            <p className="relative mt-3 text-sm leading-6 text-muted">
              收藏功能尚未开放。今日临时由鸡神代为保管。
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-6 shadow-[0_16px_42px_rgba(154,52,18,0.1)]">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-200/55 blur-2xl" />
            <h2 className="relative text-lg font-black text-main">
              岛民动态
            </h2>
            <p className="relative mt-3 text-sm leading-6 text-muted">
              动态功能尚未开放。今日状态统一记为：正在参加 SaBa 节。
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-orange-200 bg-white/75 p-6 shadow-[0_18px_50px_rgba(154,52,18,0.1)]">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">
              Chicken GOD Blessing
            </p>
            <h2 className="mt-3 text-2xl font-black text-main">
              用户页节日加护
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              该页面只在 SaBa 节限定分支中变成这样。活动结束后可以整分支回退，
              不影响长期用户系统。
            </p>

            <div className="mt-6 overflow-hidden rounded-3xl border border-orange-200 bg-orange-50">
              <img
                src="/images/chickenGOD-cover.webp"
                alt="鸡神节日限定图"
                className="h-52 w-full object-contain p-4"
                decoding="async"
              />
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-200 bg-white/75 p-6 shadow-[0_18px_50px_rgba(154,52,18,0.1)]">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">
              Island Notice
            </p>
            <h2 className="mt-3 text-2xl font-black text-main">
              今日留言区已迁入蓬莱仙岛
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              普通留言在今天会被解释为岛民祝词、鸡神神谕、SaBa 帮欢庆弹幕。
              功能仍然使用原来的评论组件。
            </p>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-orange-200 bg-white/82 p-6 shadow-[0_24px_70px_rgba(154,52,18,0.12)] backdrop-blur max-sm:p-4">
          <div className="mb-5 rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-100 via-yellow-50 to-white p-4">
            <p className="text-sm font-black text-main">
              SaBa 节限定留言板
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              愿鸡神庇佑所有人过去的一切。
            </p>
          </div>

          <CommentPanel
            targetType="user_page"
            targetId={profile.id}
            title="节日留言"
            emptyText="还没有留言。成为第一个向鸡神献上祝词的岛民。"
          />
        </section>
      </section>
    </main>
  );
}