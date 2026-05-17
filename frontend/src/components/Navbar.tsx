import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { clearAccessToken, getMe } from "../api/auth";

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Projects', to: '/projects' },
  { label: 'Works', to: '/works' },
  { label: 'About', to: '/about' },
]

function Navbar() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkLogin() {
      try {
        await getMe();

        if (isMounted) {
          setIsLoggedIn(true);
        }
      } catch {
        if (isMounted) {
          setIsLoggedIn(false);
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
    setIsLoggedIn(false);
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

        {isLoggedIn ? (
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            退出登录
          </button>
        ) : (
          <NavLink
            to="/admin/login"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            登录
          </NavLink>
        )}
      </nav>
    </header>
  )
}

export default Navbar
