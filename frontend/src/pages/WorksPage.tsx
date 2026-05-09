function WorksPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
        Works
      </p>

      <h1 className="mt-2 text-4xl font-bold text-slate-900">小说与漫画</h1>

      <p className="mt-5 max-w-3xl leading-7 text-slate-600">
        这里后续会作为个人作品区，用于上传小说章节、漫画图片、设定资料和可下载文件。当前先保留静态入口，后面再接入后端上传系统。
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 h-48 rounded-xl bg-gradient-to-br from-slate-900 to-blue-700" />
          <h2 className="text-2xl font-bold text-slate-900">小说存档</h2>
          <p className="mt-4 leading-7 text-slate-600">
            后续用于章节列表、更新时间、文件下载、版本管理。
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 h-48 rounded-xl bg-gradient-to-br from-slate-900 to-cyan-700" />
          <h2 className="text-2xl font-bold text-slate-900">漫画存档</h2>
          <p className="mt-4 leading-7 text-slate-600">
            后续用于图片上传、分卷管理、在线预览和朋友协作更新。
          </p>
        </article>
      </div>
    </section>
  )
}

export default WorksPage
