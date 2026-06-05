import { Link } from "react-router";

function WorksPage() {
  return (
    <section className="relative overflow-hidden px-4 py-8 md:px-6 md:py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.28),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.18),transparent_34%)]" />

      <div className="pointer-events-none absolute right-4 top-8 hidden rotate-6 opacity-20 md:block">
        <img
          src="/images/chickenGOD-cover.webp"
          alt=""
          className="h-64 w-64 object-contain"
          decoding="async"
        />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-orange-200 bg-white/75 p-5 shadow-[0_24px_70px_rgba(154,52,18,0.12)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-600 md:text-sm">
                SaBa Festival Works
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-main md:text-5xl">
                蓬莱仙岛作品祭坛
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-muted md:text-base md:leading-8">
                今日所有小说、漫画、随笔、黑历史与鸡神灵感统一迁入 SaBa 节临时展区。
                这是给朋友们看的限定入口，不讲长期维护，只讲节日气氛。
              </p>
            </div>

            <div className="rounded-3xl border border-orange-200 bg-orange-50/90 p-4 text-sm text-orange-900 md:w-72">
              <p className="font-bold">今日展区状态</p>
              <p className="mt-2 leading-6">
                鸡神投影：在线
                <br />
                SaBa帮档案：开放
                <br />
                蓬莱仙岛通行：允许
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:mt-10 md:grid-cols-2">
          <Link
            to="/works/novels"
            className="group relative min-h-[360px] overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-white via-amber-50 to-orange-100 p-6 shadow-[0_18px_50px_rgba(154,52,18,0.14)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(154,52,18,0.2)] md:p-8"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-yellow-200/50 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 right-2 h-72 w-72 opacity-25 transition duration-500 group-hover:scale-110 group-hover:opacity-35">
              <img
                src="/images/chickenGOD-cover.webp"
                alt=""
                className="h-full w-full object-contain"
                decoding="async"
              />
            </div>

            <div className="relative z-10 flex h-full min-h-[300px] flex-col justify-between">
              <div>
                <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  SaBa 节特别档案 01
                </span>

                <h2 className="mt-5 text-2xl font-black text-main md:text-4xl">
                  小说随笔 · 岛民传说馆
                </h2>

                <p className="mt-4 max-w-md text-sm leading-7 text-muted md:text-base md:leading-8">
                  原本只是记录小说和随笔。今天临时升级为蓬莱仙岛口述史中心：
                  所有灵感、怪话、设定、朋友之间的暗号都可以暂时供奉在这里。
                </p>
              </div>

              <div className="mt-8 grid gap-3 text-xs font-bold text-orange-900 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/75 p-3">
                  神谕文本
                  <br />
                  <span className="text-orange-500">待整理</span>
                </div>
                <div className="rounded-2xl bg-white/75 p-3">
                  岛民故事
                  <br />
                  <span className="text-orange-500">持续追加</span>
                </div>
                <div className="rounded-2xl bg-white/75 p-3">
                  节日注释
                  <br />
                  <span className="text-orange-500">限定开放</span>
                </div>
              </div>
            </div>
          </Link>

          <Link
            to="/works/comics"
            className="group relative min-h-[360px] overflow-hidden rounded-[2rem] border border-orange-300 bg-gradient-to-br from-orange-50 via-white to-yellow-100 p-6 shadow-[0_18px_50px_rgba(154,52,18,0.16)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(154,52,18,0.24)] md:p-8"
          >
            <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-orange-300/35 blur-3xl" />
            <div className="pointer-events-none absolute bottom-4 right-4 h-72 w-72 transition duration-500 group-hover:rotate-3 group-hover:scale-105">
              <img
                src="/images/chickenGOD-cover.webp"
                alt=""
                className="h-full w-full object-contain drop-shadow-2xl"
                decoding="async"
              />
            </div>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/82 to-white/20" />

            <div className="relative z-10 flex h-full min-h-[300px] max-w-md flex-col justify-between">
              <div>
                <span className="inline-flex rounded-full border border-orange-300 bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
                  SaBa 节特别档案 02
                </span>

                <h2 className="mt-5 text-2xl font-black text-main md:text-4xl">
                  漫画存档 · 鸡神正殿
                </h2>

                <p className="mt-4 text-sm leading-7 text-muted md:text-base md:leading-8">
                  图片上传、分卷管理、在线预览和朋友协作更新今天全部获得鸡神祝福。
                  这里是 SaBa 帮生日庆典的主视觉入口。
                </p>
              </div>

              <div className="mt-8 rounded-3xl border border-orange-200 bg-white/80 p-4">
                <p className="text-sm font-black text-orange-900">
                  今日限定功能幻想
                </p>
                <p className="mt-2 text-sm leading-6 text-orange-800">
                  点击进入后，所有漫画都被临时解释为鸡神圣卷、SaBa帮编年史、
                  蓬莱仙岛民俗图录。
                </p>
              </div>
            </div>
          </Link>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["鸡神圣像", "已反复加载", "bg-orange-100"],
            ["SaBa帮寿星", "正在集结", "bg-yellow-100"],
            ["蓬莱仙岛", "开放入岛", "bg-amber-100"],
            ["限定分支", "拒绝合并", "bg-red-100"],
          ].map(([title, desc, bg]) => (
            <div
              key={title}
              className={`rounded-3xl border border-orange-200 ${bg} p-5 shadow-[0_10px_30px_rgba(154,52,18,0.08)]`}
            >
              <p className="text-sm font-black text-main">{title}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
                {desc}
              </p>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}

export default WorksPage;