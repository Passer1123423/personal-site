import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMe, type AuthUser } from "../api/auth";
import { getUserProfile, type PublicUserProfile } from "../api/users";
import { resolveAssetUrl } from "../api/userProfile";
import CommentPanel from "../components/CommentPanel";
import ImagePreviewDialog, {
  type ImagePreviewItem,
} from "../components/ImagePreviewDialog";

function getInitial(name: string | null | undefined) {
  const value = (name || "").trim();

  if (!value) {
    return "?";
  }

  return value.slice(0, 1).toUpperCase();
}

function UserAvatar({
  profile,
  onPreview,
}: {
  profile: PublicUserProfile;
  onPreview: (image: ImagePreviewItem) => void;
}) {
  const avatarUrl = resolveAssetUrl(profile.avatarUrl);

  if (avatarUrl) {
    return (
      <div className="h-24 w-24 overflow-hidden rounded-full border border-[var(--color-border)] bg-white/60">
        <button
          type="button"
          className="block h-full w-full cursor-zoom-in"
          onClick={() => onPreview({ src: avatarUrl, alt: profile.displayName })}
          aria-label={`查看 ${profile.displayName} 的头像预览`}
        >
          <img
            src={avatarUrl}
            alt={profile.displayName}
            className="h-full w-full object-cover transition hover:brightness-95"
          />
        </button>
      </div>
    );
  }

  return (
    <div className="badge-accent flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold">
      {getInitial(profile.displayName)}
    </div>
  );
}

export default function UserPage() {
  const { username } = useParams();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [previewImages, setPreviewImages] = useState<ImagePreviewItem[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);

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

  const isOwnPage = currentUser?.username === profile.username;

  function openImagePreview(image: ImagePreviewItem) {
    setPreviewImages([image]);
    setPreviewImageIndex(0);
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
            <UserAvatar profile={profile} onPreview={openImagePreview} />

            <div className="min-w-0 flex-1">
              <p className="text-sm text-soft">@{profile.username}</p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-3xl font-semibold text-main">
                  {profile.displayName}
                </h1>

                {isOwnPage && (
                  <Link
                    to="/settings/profile"
                    className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-main transition hover:bg-[var(--color-panel-soft-bg)]"
                  >
                    编辑资料
                  </Link>
                )}
              </div>

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

        {previewImages.length > 0 && (
          <ImagePreviewDialog
            images={previewImages}
            currentIndex={previewImageIndex}
            onIndexChange={setPreviewImageIndex}
            onClose={() => setPreviewImages([])}
          />
        )}
      </section>
    </main>
  );
}
