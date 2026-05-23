
function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[450px] items-center justify-center overflow-hidden bg-slate-950"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{
          backgroundImage: "url('/images/hero-bg.webp')",
        }}
      />
      <div className="absolute inset-0 bg-slate-950/40" />

      <div className="relative max-w-6xl px-6 text-white" style={{ right: '320px' }}>
        <img
          src="/images/avatar.webp"
          alt="头像"
          className="rounded-xl w-15 h-15 font-semibold mb-2 border-2 border-white"
        />

        <h1 className="max-w-3xl text-4xl leading-tight md:text-6xl">
          你好，世界！
        </h1>

        <p className="mt-4 max-w-2xl mb-12 text-lg leading-7 text-slate-200">
          “只干，别多想。”
        </p>

        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href="https://github.com/samlee1020"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 hover:brightness-110 hover:underline hover:underline-offset-4"
          >
            Github
          </a>

          <a
            href="https://space.bilibili.com/401742377?spm_id_from=333.337.0.0"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-white px-6 py-3 font-semibold text-main transition hover:bg-slate-100 hover:!text-[var(--color-accent)] hover:underline hover:underline-offset-4"
          >
            Bilibili
          </a>
        </div>
      </div>
    </section>
  )
}

export default Hero
