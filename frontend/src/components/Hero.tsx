function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[520px] items-center overflow-hidden bg-slate-950"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.45),transparent_35%),radial-gradient(circle_at_80%_40%,rgba(14,165,233,0.25),transparent_30%)]" />
      <div className="absolute inset-0 bg-slate-950/40" />

      <div className="relative mx-auto max-w-6xl px-6 text-white">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-blue-200">
          Personal Website
        </p>

        <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-7xl">
          你好，世界！
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
          愿鸡神照耀过去一切。
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="#projects"
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            查看项目
          </a>

          <a
            href="#works"
            className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
          >
            小说 / 漫画
          </a>
        </div>
      </div>
    </section>
  )
}

export default Hero
