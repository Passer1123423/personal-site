import { NavLink } from "react-router-dom";
import NavbarUserMenu from "./NavbarUserMenu";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Projects", to: "/projects" },
  { label: "Works", to: "/works" },
  { label: "About", to: "/about" },
];

function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <NavLink to="/" className="text-xl font-bold link-accent">
          Passer1123423
        </NavLink>

        <div className="hidden gap-8 text-sm font-medium md:flex">
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

        <NavbarUserMenu />
      </nav>
    </header>
  );
}

export default Navbar;