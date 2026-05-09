const navItems = [
  { label: 'Home', href: '#home' },
  { label: 'Projects', href: '#projects' },
  { label: 'Works', href: '#works' },
  { label: 'About', href: '#about' },
]

function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="text-xl font-bold text-blue-600">Passer1123423</div>

        <div className="hidden gap-8 text-sm font-medium text-slate-600 md:flex">
          {navItems.map((item) => (
            <a key={item.href} className="hover:text-blue-600" href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <a
          href="#works"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          进入作品区
        </a>
      </nav>
    </header>
  )
}

export default Navbar
