import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearAccessToken, getMe } from "../api/auth";

export default function AdminHomePage() {
  const navigate = useNavigate();
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    async function checkLogin() {
      try {
        const user = await getMe();

        if (user.role !== "admin") {
          navigate("/admin/login", { replace: true });
          return;
        }

        setIsAuthReady(true);
      } catch {
        clearAccessToken();
        navigate("/admin/login", { replace: true });
      }
    }

    checkLogin();
  }, [navigate]);

  if (!isAuthReady) {
    return (
      <main className="admin-page-shell px-6 py-10">
        <section className="mx-auto max-w-5xl">
          <p className="text-sm text-soft">正在检查登录状态...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page-shell px-6 py-12">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm text-soft">Admin Console</p>
        <h1 className="mt-2 text-3xl font-semibold text-main">后台管理</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          选择要管理的模块。
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Link
            to="/admin/comics"
            className="surface-card surface-card-link p-6"
          >
            <h2 className="text-xl font-semibold text-main">漫画管理</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              上传章节、删除内容、调整章节顺序。
            </p>
          </Link>

          <Link
            to="/admin/novels"
            className="surface-card surface-card-link p-6"
          >
            <h2 className="text-xl font-semibold text-main">小说管理</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              创建小说、管理章节目录、调整章节顺序。
            </p>
          </Link>

          <Link
            to="/admin/users"
            className="surface-card surface-card-link p-6"
          >
            <h2 className="text-xl font-semibold text-main">用户管理</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              创建用户、调整权限、停用账号、重置密码。
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
