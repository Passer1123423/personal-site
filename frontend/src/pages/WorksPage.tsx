import { Link } from "react-router";

function WorksPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] link-accent md:text-sm md:tracking-[0.25em]">
        Works
      </p>

      <h1 className="mt-2 text-2xl font-bold text-main md:text-3xl">
        小说与漫画
      </h1>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:mt-5 md:text-base md:leading-7">
        SaBa帮历史的小窝
      </p>

      <div className="mt-6 grid gap-0 border-y border-[var(--color-border-soft)] md:mt-10 md:grid-cols-2 md:gap-8 md:border-y-0">
        <Link
          to="/works/novels"
          className="surface-card-link relative min-h-0 overflow-hidden border-b border-[var(--color-border-soft)] py-5 md:min-h-[340px] md:rounded-[var(--radius-card)] md:border md:border-[var(--color-border-soft)] md:bg-[var(--color-panel-bg)] md:p-8 md:shadow-[var(--shadow-card)]"
        >
          <div className="pointer-events-none absolute inset-0 hidden bg-white md:block" />

          <div className="pointer-events-none absolute bottom-6 right-6 top-6 hidden w-[52%] md:block">
            <img
              src="/images/novel-cover.webp"
              alt=""
              className="h-full w-full object-contain object-center"
              decoding="async"
            />
          </div>

          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-white via-white/88 to-white/25 md:block" />

          <div className="relative z-10 flex min-h-0 max-w-md flex-col justify-center md:min-h-[260px] md:justify-end">
            <h2 className="text-lg font-bold text-main md:text-2xl">
              小说随笔
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted md:mt-4 md:text-base md:leading-7">
              记录存储小说，随笔。
            </p>
          </div>
        </Link>

        <Link
          to="/works/comics"
          className="surface-card-link relative min-h-0 overflow-hidden py-5 md:min-h-[340px] md:rounded-[var(--radius-card)] md:border md:border-[var(--color-border-soft)] md:bg-[var(--color-panel-bg)] md:p-8 md:shadow-[var(--shadow-card)]"
        >
          <div className="pointer-events-none absolute inset-0 hidden bg-white md:block" />

          <div className="pointer-events-none absolute bottom-6 right-6 top-6 hidden w-[54%] md:block">
            <img
              src="/images/chickenGOD-cover.webp"
              alt=""
              className="h-full w-full object-contain object-center"
              decoding="async"
            />
          </div>

          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-white via-white/85 to-white/20 md:block" />

          <div className="relative z-10 flex min-h-0 max-w-md flex-col justify-center md:min-h-[260px] md:justify-end">
            <h2 className="text-lg font-bold text-main md:text-2xl">
              漫画存档
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted md:mt-4 md:text-base md:leading-7">
              用于图片上传、分卷管理、在线预览和朋友协作更新。
            </p>
          </div>
        </Link>
      </div>
    </section>
  );
}

export default WorksPage;