import { useState } from "react";
import { NavLink } from "react-router-dom";
import NavbarUserMenu from "./NavbarUserMenu";

type NavbarMode = "standard" | "auto";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Projects", to: "/projects" },
  { label: "Works", to: "/works" },
  { label: "About", to: "/about" },
];

function NavbarContent({ closeMenu }: { closeMenu: () => void }) {
  return (
    <nav className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-6 md:py-4">
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
    </nav>
  );
}

function MobileNavbarContent({
  closeMenu,
  isMenuOpen,
  toggleMenu,
}: {
  closeMenu: () => void;
  isMenuOpen: boolean;
  toggleMenu: () => void;
}) {
  return (
    <nav className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <NavLink
        to="/"
        className="min-w-0 truncate text-xl font-bold link-accent"
        onClick={closeMenu}
      >
        Passer1123423
      </NavLink>

      <div className="flex items-center justify-end gap-1.5">
        <NavbarUserMenu />

        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-white/90 text-slate-700 shadow-sm transition hover:border-[var(--color-accent-border-strong)] hover:text-[var(--color-accent)]"
          aria-label={isMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
          aria-expanded={isMenuOpen}
          onClick={toggleMenu}
        >
          <span className="grid gap-1">
            <span className="block h-0.5 w-4 rounded-full bg-current" />
            <span className="block h-0.5 w-4 rounded-full bg-current" />
            <span className="block h-0.5 w-4 rounded-full bg-current" />
          </span>
        </button>
      </div>
    </nav>
  );
}

function MobileNavbarMenu({ closeMenu }: { closeMenu: () => void }) {
  return (
    <div className="absolute left-0 right-0 top-full z-30 px-4 pt-2">
      <div className="mx-auto max-w-6xl rounded-xl border border-[var(--color-border-soft)] bg-white/95 p-2 shadow-lg backdrop-blur">
        <div className="grid grid-cols-2 gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={closeMenu}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-center text-sm font-medium transition ${
                  isActive
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel-soft-bg)] hover:text-[var(--color-accent)]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

function Navbar({ mode = "standard" }: { mode?: NavbarMode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen((value) => !value);
  };

  const mobileNav = (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur md:hidden">
      <MobileNavbarContent
        closeMenu={closeMenu}
        isMenuOpen={isMenuOpen}
        toggleMenu={toggleMenu}
      />

      {isMenuOpen ? <MobileNavbarMenu closeMenu={closeMenu} /> : null}
    </header>
  );

  if (mode === "auto") {
    return (
      <>
        {mobileNav}

        <div className="group pointer-events-none fixed inset-x-0 top-0 z-50 hidden md:block">
          <div className="pointer-events-auto h-1.5" aria-hidden="true" />

          <header className="pointer-events-auto absolute inset-x-0 top-0 -translate-y-[calc(100%-0.375rem)] border-b border-slate-200 bg-white/95 opacity-0 shadow-lg backdrop-blur transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
            <NavbarContent closeMenu={closeMenu} />
          </header>
        </div>
      </>
    );
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="hidden md:block">
        <NavbarContent closeMenu={closeMenu} />
      </div>

      <div className="md:hidden">
        <MobileNavbarContent
          closeMenu={closeMenu}
          isMenuOpen={isMenuOpen}
          toggleMenu={toggleMenu}
        />
      </div>

      {isMenuOpen ? (
        <div className="md:hidden">
          <MobileNavbarMenu closeMenu={closeMenu} />
        </div>
      ) : null}
    </header>
  );
}

export default Navbar;
