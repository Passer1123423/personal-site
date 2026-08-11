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

      <div className="mt-8 grid gap-6 md:mt-10 md:grid-cols-2">
        <Link
          to="/works/novels"
          className="group relative min-h-[360px] overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_28px_70px_rgba(37,99,235,0.14)] md:p-8"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-blue-100/60 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 right-2 h-72 w-72 opacity-20 transition duration-500 group-hover:scale-110 group-hover:opacity-30">
            <img
              src="/images/chickenGOD-cover.webp"
              alt=""
              className="h-full w-full object-contain"
              decoding="async"
            />
          </div>

          <div className="relative z-10 flex h-full min-h-[300px] flex-col justify-between">
            <div>
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                SaBa 绝密档案 01
              </span>

              <h2 className="mt-5 text-2xl font-black text-main md:text-4xl">
                小说随笔
              </h2>

              <p className="mt-4 max-w-md text-sm leading-7 text-muted md:text-base md:leading-8">
                记录小说和随笔。
              </p>
            </div>

            <div className="mt-8 grid gap-3 text-xs font-bold text-slate-700 sm:grid-cols-3">
              <div className="min-h-[76px] rounded-2xl border border-blue-100 bg-white/80 p-3">
                小说上传
                <br />
                <span className="text-blue-600">平台存档</span>
              </div>
              <div className="min-h-[76px] rounded-2xl border border-blue-100 bg-white/80 p-3">
                随笔记录
                <br />
                <span className="text-blue-600">随时上传</span>
              </div>
              <div className="min-h-[76px] rounded-2xl border border-blue-100 bg-white/80 p-3">
                摸鱼珍藏
                <br />
                <span className="text-blue-600">尽情探索</span>
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/works/comics"
          className="group relative min-h-[360px] overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_28px_70px_rgba(37,99,235,0.14)] md:p-8"
        >
          <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-blue-100/55 blur-3xl" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-72 w-72 transition duration-500 group-hover:rotate-3 group-hover:scale-105">
            <img
              src="/images/chickenGOD-cover.webp"
              alt=""
              className="h-full w-full object-contain drop-shadow-2xl"
              decoding="async"
            />
          </div>

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/25" />

          <div className="relative z-10 flex h-full min-h-[300px] max-w-md flex-col justify-between">
            <div>
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                SaBa 绝密档案 02
              </span>

              <h2 className="mt-5 text-2xl font-black text-main md:text-4xl">
                漫画存档
              </h2>

              <p className="mt-4 text-sm leading-7 text-muted md:text-base md:leading-8">
                图片上传、分卷管理、在线预览和SaBa协作更新
              </p>
            </div>

            <div className="relative mt-8 min-h-[76px] overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white/90 via-white/85 to-blue-50/80 p-4">
              <div className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-blue-100/70 blur-2xl" />

              <div className="relative">
                <p className="text-sm font-black text-slate-800">
                  远方的来客
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  点击进入吧，为了Saba帮的历史。
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

export default WorksPage;