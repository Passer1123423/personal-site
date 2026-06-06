function App() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-xl font-bold text-blue-600">Passer1123423</div>

          <div className="hidden gap-8 text-sm font-medium text-slate-600 md:flex">
            <a className="hover:text-blue-600" href="#home">Home</a>
            <a className="hover:text-blue-600" href="#projects">Projects</a>
            <a className="hover:text-blue-600" href="#works">Works</a>
            <a className="hover:text-blue-600" href="#about">About</a>
          </div>

          <a
            href="#works"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            进入作品区
          </a>
        </nav>
      </header>

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

      <section 
        id="projects" 
        className="mx-auto max-w-6xl px-6 py-16"
      >
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
              Projects
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">精选项目</h2>
          </div>
          <a className="text-sm font-semibold text-blue-600 hover:text-blue-700" href="#projects">
            查看全部 →
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["一维势垒穿透可视化", "数值求解能量本征态，展示波函数、概率密度与含时演化。"],
            ["黄焖鸡项目：CGCNN 材料带隙预测", "基于晶体图卷积网络与传统机器学习的材料性质预测实践。"],
            ["个人网站系统", "用于项目展示、作品发布、文件上传与朋友协作更新。"],
          ].map(([title, desc]) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-5 h-36 rounded-xl bg-gradient-to-br from-slate-900 to-blue-700" />
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section 
        id="works" 
        className="border-y border-slate-200 bg-white"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-100 p-8">
            <h2 className="text-2xl font-bold text-slate-900">小说存档</h2>
            <p className="mt-4 leading-7 text-slate-600">
              后续用于上传章节、整理目录、展示更新记录，并支持下载。
            </p>
          </div>

          <div className="rounded-2xl bg-slate-100 p-8">
            <h2 className="text-2xl font-bold text-slate-900">漫画存档</h2>
            <p className="mt-4 leading-7 text-slate-600">
              后续用于上传图片、分卷管理、预览阅读，并支持朋友协作更新。
            </p>
          </div>
        </div>
      </section>

      <footer id="about" className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-500">
        © 2026 Xie Juntao. Built with React, Vite and Tailwind CSS.
      </footer>
    </main>
  )
}

export default App
