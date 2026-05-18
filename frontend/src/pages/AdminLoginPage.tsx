import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearAccessToken, getMe, login, saveAccessToken } from "../api/auth";

export default function AdminLoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function redirectIfAlreadyLoggedIn() {
      try {
        const user = await getMe();
        navigate(`/users/${user.username}`, { replace: true });
      } catch {
        clearAccessToken();
      }
    }

    redirectIfAlreadyLoggedIn();
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await login(username.trim(), password);
      saveAccessToken(result.accessToken);
      navigate(`/users/${result.user.username}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <section className="mx-auto max-w-md rounded-3xl border border-blue-100 bg-white p-8 shadow-xl shadow-blue-100/60">
        <p className="text-sm text-blue-500">Personal Site</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">登录账号</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          登录后会进入你的用户主页。管理员后台可手动访问。
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm text-slate-700">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-700">密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="mt-2 w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              autoComplete="current-password"
              required
            />
          </label>

          <p className="text-sm text-slate-500">
            没有账号？{" "}
            <Link
              to="/register"
              className="inline-block text-blue-600 underline underline-offset-4 transition hover:scale-110 hover:text-blue-500"
            >
              注册
            </Link>
          </p>

          {errorMessage && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "登录中..." : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}