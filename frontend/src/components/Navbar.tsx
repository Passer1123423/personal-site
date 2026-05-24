import { useState } from "react";
import { NavLink } from "react-router-dom";
import NavbarUserMenu from "./NavbarUserMenu";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Projects", to: "/projects" },
  { label: "Works", to: "/works" },
  { label: "About", to: "/about" },
];

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-6 py-4 md:grid-cols-[1fr_auto_1fr]">
        <NavLink
          to="/"
          className="min-w-0 truncate text-xl font-bold link-accent"
          onClick={closeMenu}
        >
          Passer1123423
        </NavLink>

        <div className="hidden justify-center gap-8 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `border-b-2 pb-1 link-accent transition ${
                  isActive
                    ? "border-blue-600"
                    : "border-transparent hover:border-blue-300"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden justify-end md:flex">
          <NavbarUserMenu />
        </div>

        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center justify-self-end rounded-lg border border-slate-300 bg-white text-slate-900 hover:border-blue-400 hover:text-blue-600 md:hidden"
          aria-label={isMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((value) => !value)}
        >
          <span className="grid gap-1">
            <span className="block h-0.5 w-4 rounded-full bg-current" />
            <span className="block h-0.5 w-4 rounded-full bg-current" />
            <span className="block h-0.5 w-4 rounded-full bg-current" />
          </span>
        </button>
      </nav>

      {isMenuOpen ? (
        <div className="mx-auto max-w-6xl px-6 pb-4 md:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-center text-sm transition ${
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="mt-3 flex justify-center border-t border-slate-200 pt-3">
              <NavbarUserMenu />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default Navbar;