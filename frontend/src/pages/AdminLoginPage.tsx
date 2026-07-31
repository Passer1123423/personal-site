import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { clearAccessToken, getMe, login, saveAccessToken } from "../api/auth";

function getSafeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = getSafeRedirectPath(searchParams.get("next"));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function redirectIfAlreadyLoggedIn() {
      try {
        const user = await getMe();
        navigate(nextPath ?? `/users/${user.username}`, { replace: true });
      } catch {
        clearAccessToken();
      }
    }

    redirectIfAlreadyLoggedIn();
  }, [navigate, nextPath]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await login(username.trim(), password);
      saveAccessToken(result.accessToken);
      navigate(nextPath ?? `/users/${result.user.username}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page-shell px-6 py-16">
      <section className="auth-card mx-auto max-w-md p-8">
        <p className="text-sm link-accent">Personal Site</p>
        <h1 className="mt-2 text-3xl font-semibold text-main">登录账号</h1>
        <p className="mt-3 text-sm leading-6 text-soft">
          登录后会进入你的用户主页。
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm text-muted">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="auth-input mt-2 w-full px-4 py-3 transition"
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted">密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="auth-input mt-2 w-full px-4 py-3 transition"
              autoComplete="current-password"
              required
            />
          </label>

          <p className="text-sm text-soft">
            没有账号？{" "}
            <Link
              to="/register"
              className="inline-block link-accent underline underline-offset-4 transition hover:scale-110"
            >
              注册
            </Link>
          </p>

          {errorMessage && (
            <p className="message-error px-4 py-3 text-sm">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="auth-button-primary w-full px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "登录中..." : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
