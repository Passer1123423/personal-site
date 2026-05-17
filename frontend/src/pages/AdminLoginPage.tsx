import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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

        if (user.role === "admin") {
          navigate("/admin/comics", { replace: true });
        }
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

      if (result.user.role === "admin") {
        navigate("/admin/comics");
      } else {
        setErrorMessage("当前账号暂无后台权限。");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <p className="text-sm text-slate-400">Personal Site Admin</p>
        <h1 className="mt-2 text-3xl font-semibold">登录账号</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          用站长创建的账号登录。当前只有管理员账号可以进入漫画后台。
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm text-slate-300">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-white/30"
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-white/30"
              autoComplete="current-password"
              required
            />
          </label>

          {errorMessage && (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "登录中..." : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
