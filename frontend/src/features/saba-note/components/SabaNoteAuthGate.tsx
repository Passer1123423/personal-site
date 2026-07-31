import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { getAccessToken } from "../../../api/auth";
import {
  SabaNoteSessionError,
  verifySabaNoteSession,
} from "../api/session";
import SabaNoteShell from "./SabaNoteShell";

type AuthState = "checking" | "authenticated" | "unauthenticated" | "error";

export default function SabaNoteAuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [attempt, setAttempt] = useState(0);
  const [authState, setAuthState] = useState<AuthState>(() =>
    getAccessToken() ? "checking" : "unauthenticated",
  );

  useEffect(() => {
    function handleAuthChanged() {
      if (!getAccessToken()) {
        setAuthState("unauthenticated");
        return;
      }

      setAuthState("checking");
      setAttempt((current) => current + 1);
    }

    window.addEventListener("auth-changed", handleAuthChanged);
    window.addEventListener("storage", handleAuthChanged);
    return () => {
      window.removeEventListener("auth-changed", handleAuthChanged);
      window.removeEventListener("storage", handleAuthChanged);
    };
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      return;
    }

    let active = true;
    void verifySabaNoteSession()
      .then(() => {
        if (active) setAuthState("authenticated");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (
          reason instanceof SabaNoteSessionError &&
          (reason.status === 401 || reason.status === 403)
        ) {
          setAuthState("unauthenticated");
          return;
        }
        setAuthState("error");
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  if (authState === "authenticated") {
    return children;
  }

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const next = encodeURIComponent(returnTo);

  return (
    <SabaNoteShell>
      <main className="saba-note-auth-page">
        <section className="surface-card saba-note-auth-card" aria-live="polite">
          <div className="saba-note-auth-mark" aria-hidden="true">
            {authState === "checking" ? (
              <span className="saba-note-auth-loading">···</span>
            ) : (
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7.5 10V7.75a4.5 4.5 0 0 1 9 0V10" />
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M12 14v2.5" />
              </svg>
            )}
          </div>

          {authState === "checking" ? (
            <>
              <p className="saba-note-auth-eyebrow">Private workspace</p>
              <h1>正在确认登录状态</h1>
              <p>稍等一下，你的私人知识空间正在准备中。</p>
            </>
          ) : authState === "error" ? (
            <>
              <p className="saba-note-auth-eyebrow">Connection check</p>
              <h1>暂时无法确认登录状态</h1>
              <p>
                可能是网络或认证服务暂时不可用。你的登录信息不会因此被清除，可以稍后重试。
              </p>
              <div className="saba-note-auth-actions">
                <button
                  type="button"
                  className="saba-note-auth-primary"
                  onClick={() => {
                    setAuthState("checking");
                    setAttempt((current) => current + 1);
                  }}
                >
                  重新检查
                </button>
                <Link to="/" className="saba-note-auth-secondary">
                  返回首页
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="saba-note-auth-eyebrow">Private workspace</p>
              <h1>登录后进入 Saba-Note</h1>
              <p>
                这里保存的是与你账号关联的私人推导、标签和知识结构。登录后即可继续写作与整理。
              </p>
              <div className="saba-note-auth-actions">
                <Link
                  to={`/admin/login?next=${next}`}
                  className="saba-note-auth-primary"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="saba-note-auth-secondary"
                >
                  注册账号
                </Link>
              </div>
              <p className="saba-note-auth-footnote">
                登录仅用于识别你的知识空间，不会公开其中的内容。
              </p>
            </>
          )}
        </section>
      </main>
    </SabaNoteShell>
  );
}
