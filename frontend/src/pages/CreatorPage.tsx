import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearAccessToken, getMe } from "../api/auth";

export default function CreatorPage() {
  const navigate = useNavigate();
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    async function checkLogin() {
      try {
        const user = await getMe();

        if (user.role !== "admin" && user.role !== "author") {
          navigate("/", { replace: true });
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
        <p className="text-sm text-soft">Creator Console</p>
        <h1 className="mt-2 text-3xl font-semibold text-main">创作中心</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          管理你拥有 owner 权限的作品。
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Link
            to="/creator/comics"
            className="surface-card surface-card-link p-6"
          >
            <h2 className="text-xl font-semibold text-main">漫画创作</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              上传漫画图片、发布章节、管理作品归属。
            </p>
          </Link>

          <Link
            to="/creator/novels"
            className="surface-card surface-card-link p-6"
          >
            <h2 className="text-xl font-semibold text-main">小说创作</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              创建小说、编辑章节正文、管理封面和简介。
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
