import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { clearAccessToken, getMe, type AuthUser } from "../api/auth";

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Projects', to: '/projects' },
  { label: 'Works', to: '/works' },
  { label: 'About', to: '/about' },
]

function Navbar() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkLogin() {
      try {
        const user = await getMe();

        if (isMounted) {
          setCurrentUser(user);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      }
    }

    checkLogin();

    window.addEventListener("auth-changed", checkLogin);

    return () => {
      isMounted = false;
      window.removeEventListener("auth-changed", checkLogin);
    };
  }, []);

  function handleLogout() {
    clearAccessToken();
    setCurrentUser(null);
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <NavLink to="/" className="text-xl font-bold text-blue-600">
          Passer1123423
        </NavLink>

        <div className="hidden gap-8 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `border-b-2 pb-1 text-blue-600 transition ${
                  isActive
                    ? 'border-blue-600'
                    : 'border-transparent hover:border-blue-300'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {currentUser ? (
          <div className="flex items-center gap-3">
            <Link
              to={`/users/${currentUser.username}`}
              className="inline-block text-sm font-semibold text-blue-600 underline underline-offset-4 transition duration-150 hover:scale-110 hover:-rotate-1 hover:text-blue-600"
              title="进入用户主页"
            >
              {currentUser.displayName || currentUser.username}
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              退出登录
            </button>
          </div>
        ) : (
          <NavLink
            to="/admin/login"
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
          >
            登录
          </NavLink>
        )}
      </nav>
    </header>
  )
}

export default Navbar
