import { Link } from 'react-router'

function WorksPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
        Works
      </p>

      <h1 className="mt-2 text-3xl font-bold text-main">小说与漫画</h1>

      <p className="mt-5 max-w-3xl leading-7 text-muted">
        SaBa帮历史的小窝
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <Link
          to="/works/novels"
          className="surface-card surface-card-link relative min-h-[340px] overflow-hidden p-8"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-white"
            style={{
              backgroundImage: "url('/images/novel-cover.webp')",
              backgroundRepeat: "no-repeat",
              backgroundSize: "58% auto",
              backgroundPosition: "right 48px center",
            }}
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/88 to-white/25" />

          <div className="relative z-10 flex min-h-[260px] max-w-md flex-col justify-end">
            <h2 className="text-2xl font-bold text-main">小说存档</h2>

            <p className="mt-4 leading-7 text-muted">
              用于整理小说正文、章节目录和后续阅读评论入口。
            </p>
          </div>
        </Link>

        <Link
          to="/works/comics"
          className="surface-card surface-card-link relative min-h-[340px] overflow-hidden p-8"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-white"
            style={{
              backgroundImage: "url('/images/chickenGOD-cover.webp')",
              backgroundRepeat: "no-repeat",
              backgroundSize: "64% auto",
              backgroundPosition: "right 48px center",
            }}
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/20" />

          <div className="relative z-10 flex min-h-[260px] max-w-md flex-col justify-end">
            <h2 className="text-2xl font-bold text-main">漫画存档</h2>

            <p className="mt-4 leading-7 text-muted">
              用于图片上传、分卷管理、在线预览和朋友协作更新。
            </p>
          </div>
        </Link>
      </div>
    </section>
  )
}

export default WorksPage
