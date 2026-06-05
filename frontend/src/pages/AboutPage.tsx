const festivalRules = [
  '今日所有访客默认获得 SaBa 帮临时席位。',
  '蓬莱仙岛开放期间，鸡神封面图拥有最高展示优先级。',
  '本页面为活动限定内容，活动结束后可以整页丢弃，不进入长期维护。',
]

function AboutPage() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.28),transparent_32%),linear-gradient(180deg,#fff7ed_0%,#ffffff_50%,#f8fafc_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(90deg,rgba(251,146,60,0.12)_1px,transparent_1px),linear-gradient(0deg,rgba(251,146,60,0.12)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div>
          <p className="inline-flex rounded-full border border-orange-300 bg-white/80 px-4 py-2 text-sm font-black uppercase tracking-[0.25em] text-orange-600 shadow-sm backdrop-blur">
            About · SaBa Festival Edition
          </p>

          <h1 className="mt-5 text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
            关于本站，
            <span className="block bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 bg-clip-text text-transparent">
              以及今日的蓬莱仙岛临时庆典
            </span>
          </h1>

          <div className="mt-8 max-w-3xl space-y-5 rounded-[2rem] border border-orange-200 bg-white/80 p-5 leading-8 text-slate-700 shadow-sm backdrop-blur sm:p-7">
            <p>
              GPT说这里可以放个人介绍、研究兴趣、项目方向、联系方式和网站说明。但在 SaBa 节限定分支中，这里暂时被征用为鸡神和 SaBa 帮生日庆典公告栏。
            </p>

            <p>
              当前网站先作为个人项目展示与作品整理平台，后续会酌情盗取SamLee的劳动成果。今日额外承担蓬莱仙岛入口、朋友聚集指示牌、鸡神封面图展示墙和 SaBa 帮祝福广播站等临时职责。
            </p>

            <p>
              本次改动属于节日限定小分支的大型临时样式实验，不追求长期复用，也不准备合并回其它稳定分支。活动结束后可以直接切回 main，让网站恢复正常形态。
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {festivalRules.map((rule, index) => (
              <div key={rule} className="rounded-2xl border border-amber-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-black text-orange-500">0{index + 1}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-[2rem] border border-orange-200 bg-white/85 p-3 shadow-2xl shadow-orange-200/50 backdrop-blur lg:sticky lg:top-24">
          <img
            src="/images/chickenGOD-cover.webp"
            alt="鸡神 SaBa 节限定侧栏"
            className="aspect-[3/4] w-full rounded-[1.5rem] object-cover"
          />
          <div className="p-4">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Festival Badge</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">鸡神在此</h2>
            <p className="mt-3 leading-7 text-slate-700">
              这里原本只是普通关于页，现在临时升级为 SaBa 节纪念碑。我们坚信：图片越多，节日气氛越强！
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default AboutPage
