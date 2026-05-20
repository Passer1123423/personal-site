// src/components/NavbarUserMenu.tsx

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { clearAccessToken, getMe, type AuthUser } from "../api/auth";

function AvatarPlaceholder({
  user,
  sizeClass = "h-9 w-9",
}: {
  user: AuthUser;
  sizeClass?: string;
}) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
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

export default function NavbarUserMenu() {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);

  async function loadUser() {
    try {
      const currentUser = await getMe();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    loadUser();

    function handleAuthChanged() {
      loadUser();
    }

    window.addEventListener("auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChanged);
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
        登录
      </Link>
    );
  }

  const profileHref = `/users/${user.username}`;
  const canUploadComics = user.role === "author" || user.role === "admin";
  const canManageAdmin = user.role === "admin";

  function handleLogout() {
    clearAccessToken();
    setUser(null);
    setOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="group inline-flex items-center gap-2 rounded-full bg-transparent px-2 py-1.5 text-sm font-semibold text-main transition hover:bg-[var(--color-panel-soft-bg)]"
        onClick={() => setOpen((value) => !value)}
      >
        <AvatarPlaceholder user={user} sizeClass="h-8 w-8" />

        <span className="hidden max-w-24 truncate group-hover:underline group-hover:underline-offset-4 sm:inline">
          {user.displayName || user.username}
        </span>

        <span className="text-xs text-soft">▾</span>
      </button>

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

            {canUploadComics && (
              <Link
                to="/creator/comics"
                className="block rounded-xl px-3 py-2 text-sm text-main transition hover:bg-[var(--color-panel-soft-bg)] hover:pl-4"
                onClick={() => setOpen(false)}
              >
                漫画上传
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