import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register, saveAccessToken } from "../api/auth";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (password !== confirmPassword) {
        setErrorMessage("两次输入的密码不一致");
        return;
      }

      const result = await register({
        username: username.trim(),
        displayName: displayName.trim(),
        password,
      });

      saveAccessToken(result.accessToken);
      navigate(`/users/${result.user.username}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "注册失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page-shell px-6 py-16">
      <section className="auth-card mx-auto max-w-md p-8">
        <p className="text-sm link-accent">Personal Site</p>
        <h1 className="mt-2 text-3xl font-semibold text-main">注册账号</h1>
        <p className="mt-3 text-sm leading-6 text-soft">
          注册后默认为 reader 账号。作者或管理员权限需要站长手动调整。
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm text-muted">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="auth-input mt-2 w-full px-4 py-3 transition"
              autoComplete="username"
              placeholder="用于登录和个人主页地址"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted">显示名</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="auth-input mt-2 w-full px-4 py-3 transition"
              placeholder="可以以后修改"
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
              autoComplete="new-password"
              placeholder="至少 6 位"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted">确认密码</span>
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              className="auth-input mt-2 w-full px-4 py-3 transition"
              autoComplete="new-password"
              placeholder="再次输入密码"
              required
            />
          </label>

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
            {isSubmitting ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-soft">
          已有账号？{" "}
          <Link
            to="/admin/login"
            className="inline-block link-accent underline underline-offset-4 transition hover:scale-110"
          >
            去登录
          </Link>
        </p>
      </section>
    </main>
  );
}
