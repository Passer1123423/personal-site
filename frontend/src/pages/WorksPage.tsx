import { Link } from 'react-router'

function WorksPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
        Works
      </p>

      <h1 className="mt-2 text-3xl font-bold text-main">小说与漫画</h1>

      <p className="mt-5 max-w-3xl leading-7 text-muted">
        这里后续会作为个人作品区，用于上传小说章节、漫画图片、设定资料和可下载文件。当前先保留静态入口，后面再接入后端上传系统。
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <article className="surface-card p-8">
          <div className="mb-6 h-48 rounded-xl bg-gradient-to-br from-slate-900 to-blue-700" />
          <h2 className="text-2xl font-bold text-main">小说存档</h2>
          <p className="mt-4 leading-7 text-muted">
            后续用于章节列表、更新时间、文件下载、版本管理。
          </p>
        </article>

        <Link
          to="/works/comics"
          className="surface-card surface-card-link p-8"
        >
          <div className="mb-6 h-48 rounded-xl bg-gradient-to-br from-slate-900 to-cyan-700" />
          <h2 className="text-2xl font-bold text-main">漫画存档</h2>
          <p className="mt-4 leading-7 text-muted">
            后续用于图片上传、分卷管理、在线预览和朋友协作更新。
          </p>
        </Link>
      </div>
    </section>
  )
}

export default WorksPage
