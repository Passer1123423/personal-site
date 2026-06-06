import { useState } from "react";
import { NavLink } from "react-router-dom";
import NavbarUserMenu from "./NavbarUserMenu";

const navItems = [
  { label: "蓬莱入口", to: "/" },
  { label: "项目供桌", to: "/projects" },
  { label: "作品神殿", to: "/works" },
  { label: "节日宣言", to: "/about" },
];

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-orange-200 bg-orange-50/90 shadow-sm shadow-orange-100/70 backdrop-blur">
      <div className="bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 px-4 py-1 text-center text-[11px] font-black uppercase tracking-[0.24em] text-white">
        SaBa节限定模式运行中 · 愿鸡神照耀过去一切
      </div>

      <nav className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-6 md:py-4">
        <NavLink
          to="/"
          className="flex min-w-0 items-center gap-2 truncate text-lg font-black text-orange-700 transition hover:text-orange-600 sm:text-xl"
          onClick={closeMenu}
        >
          <img
            src="/images/chickenGOD-cover.webp"
            alt="SaBa节限定站点图标"
            className="h-9 w-9 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
          />
          <span className="truncate">Passer1123423 · SaBa节</span>
        </NavLink>

        <div className="hidden justify-center gap-6 text-sm font-bold md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `rounded-full border px-3 py-1.5 transition ${
                  isActive
                    ? "border-orange-500 bg-white text-orange-700 shadow-sm"
                    : "border-transparent text-slate-700 hover:border-orange-300 hover:bg-white/70 hover:text-orange-600"
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

        <div className="flex items-center justify-end gap-1.5 md:hidden">
          <NavbarUserMenu />

          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-orange-300 bg-white/90 text-orange-700 shadow-sm transition hover:border-orange-500 hover:text-orange-600"
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
        </div>
      </nav>

      {isMenuOpen ? (
        <div className="absolute left-0 right-0 top-full z-30 px-4 pt-2 md:hidden">
          <div className="mx-auto max-w-6xl rounded-2xl border border-orange-200 bg-orange-50/95 p-2 shadow-lg shadow-orange-100 backdrop-blur">
            <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/80 p-2">
              <img
                src="/images/chickenGOD-cover.webp"
                alt="移动端 SaBa 节菜单图标"
                className="h-11 w-11 rounded-xl object-cover"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">SaBa Mobile Gate</p>
                <p className="text-sm font-bold text-slate-800">蓬莱仙岛移动入口已开启</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2 text-center text-sm font-bold transition ${
                      isActive
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-white/75 text-slate-700 hover:bg-orange-100 hover:text-orange-700"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default Navbar;
