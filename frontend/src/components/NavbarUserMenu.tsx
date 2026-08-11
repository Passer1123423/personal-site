// src/components/NavbarUserMenu.tsx

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { clearAccessToken, getMe, type AuthUser } from "../api/auth";
import { fetchUnreadNotificationCount } from "../api/notifications";
import { resolveAssetUrl } from "../api/userProfile";

function AvatarPlaceholder({
  user,
  sizeClass = "h-9 w-9",
}: {
  user: AuthUser;
  sizeClass?: string;
}) {
  const avatarUrl = resolveAssetUrl(user.avatarUrl);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user.displayName || user.username}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]`}
    >
      {user.displayName?.[0] || user.username[0]?.toUpperCase() || "U"}
    </div>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.75 6.75h14.5v10.5H4.75z" />
      <path d="m5.25 7.25 6.2 5.15a.85.85 0 0 0 1.1 0l6.2-5.15" />
    </svg>
  );
}

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  const label = count > 99 ? "99+" : String(count);
  const isSingleDigit = count < 10;

  return (
    <span
      className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-[var(--color-danger)] px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white transition group-hover:scale-110 ${
        isSingleDigit ? "rounded-full" : "rounded-full"
      }`}
    >
      {label}
    </span>
  );
}

function NotificationLink({
  unreadCount,
  onOpen,
}: {
  unreadCount: number;
  onOpen: () => void;
}) {
  return (
    <Link
      to="/notifications"
      aria-label={
        unreadCount > 0 ? `查看通知，${unreadCount} 条未读` : "查看通知"
      }
      className="group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-soft transition hover:-translate-y-0.5 hover:bg-white hover:text-[var(--color-accent)] hover:shadow-sm"
      onClick={onOpen}
    >
      <MailIcon />
      <NotificationBadge count={unreadCount} />
    </Link>
  );
}

export default function NavbarUserMenu() {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadUnreadCount() {
    try {
      const count = await fetchUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }

  async function loadUser() {
    try {
      const currentUser = await getMe();
      setUser(currentUser);
      await loadUnreadCount();
    } catch {
      setUser(null);
      setUnreadCount(0);
    }
  }

  useEffect(() => {
    loadUser();

    function handleAuthChanged() {
      loadUser();
    }

    function handleNotificationsChanged() {
      loadUnreadCount();
    }

    window.addEventListener("auth-changed", handleAuthChanged);
    window.addEventListener("notifications-changed", handleNotificationsChanged);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChanged);
      window.removeEventListener(
        "notifications-changed",
        handleNotificationsChanged,
      );
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  if (!user) {
    return (
      <Link
        to="/admin/login"
        className="rounded-full border border-[var(--color-border-soft)] bg-white/90 px-4 py-2 text-sm font-semibold text-main shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-accent-border-strong)] hover:bg-white hover:text-[var(--color-accent)] hover:shadow-md"
      >
        管理登录
      </Link>
    );
  }

  const profileHref = `/users/${user.username}`;
  const canUploadComics = user.role === "author" || user.role === "admin";
  const canManageAdmin = user.role === "admin";

  function handleLogout() {
    clearAccessToken();
    setUser(null);
    setUnreadCount(0);
    setOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <div className="group inline-flex items-center gap-1 rounded-full bg-transparent px-2 py-1.5 text-sm font-semibold text-main transition hover:bg-[var(--color-panel-soft-bg)]">
        <button
          type="button"
          className="inline-flex min-w-0 items-center gap-2"
          onClick={() => setOpen((value) => !value)}
        >
          <AvatarPlaceholder user={user} sizeClass="h-8 w-8" />

          <span className="hidden max-w-24 truncate group-hover:underline group-hover:underline-offset-4 sm:inline">
            {user.displayName || user.username}
          </span>
        </button>

        <NotificationLink
          unreadCount={unreadCount}
          onOpen={() => setOpen(false)}
        />

        <button
          type="button"
          className="inline-flex h-7 w-5 shrink-0 items-center justify-center text-xs text-soft transition hover:text-[var(--color-accent)]"
          aria-label={open ? "收起用户菜单" : "展开用户菜单"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          ▾
        </button>
      </div>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] px-4 py-3">
            <Link
              to={profileHref}
              className="group flex items-center gap-3"
              onClick={() => setOpen(false)}
            >
              <AvatarPlaceholder user={user} sizeClass="h-10 w-10" />

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-main group-hover:underline group-hover:underline-offset-4">
                  {user.displayName || user.username}
                </p>
                <p className="mt-1 truncate text-xs text-soft">
                  @{user.username}
                </p>
              </div>
            </Link>
          </div>

          <div className="space-y-1 px-2 py-2">
            <Link
              to={profileHref}
              className="block rounded-xl px-3 py-2 text-sm text-main transition hover:bg-[var(--color-panel-soft-bg)] hover:pl-4"
              onClick={() => setOpen(false)}
            >
              个人主页
            </Link>

            <Link
              to="/notifications"
              className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-main transition hover:bg-[var(--color-panel-soft-bg)] hover:pl-4"
              onClick={() => setOpen(false)}
            >
              <span>消息通知</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[var(--color-danger)] px-2 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {canUploadComics && (
              <Link
                to="/creator"
                className="block rounded-xl px-3 py-2 text-sm text-main transition hover:bg-[var(--color-panel-soft-bg)] hover:pl-4"
                onClick={() => setOpen(false)}
              >
                作品上传
              </Link>
            )}

            {canManageAdmin && (
              <Link
                to="/admin"
                className="block rounded-xl px-3 py-2 text-sm text-main transition hover:bg-[var(--color-panel-soft-bg)] hover:pl-4"
                onClick={() => setOpen(false)}
              >
                管理后台
              </Link>
            )}

            <Link
              to={"/settings/profile"}
              className="block rounded-xl px-3 py-2 text-sm text-main transition hover:bg-[var(--color-panel-soft-bg)] hover:pl-4"
              onClick={() => setOpen(false)}
            >
              进入设置
            </Link>

            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--color-danger)] transition hover:bg-[var(--color-danger-bg)] hover:pl-4"
              onClick={handleLogout}
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}