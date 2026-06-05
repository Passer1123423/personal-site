import ProjectCard from '../components/ProjectCard'
import SectionTitle from '../components/SectionTitle'
import { projects } from '../data/projects'
import { Link } from 'react-router'

const chickenGodImages = [
  '/images/chickenGOD-cover.webp',
  '/images/chickenGOD-cover.webp',
  '/images/chickenGOD-cover.webp',
]

const festivalStats = [
  { label: '蓬莱集结进度', value: '100%' },
  { label: '鸡神神谕同步率', value: '06.06' },
  { label: 'SaBa帮今日战力', value: '∞' },
]

const festivalRituals = [
  '向鸡神封面图进行三次注目礼',
  '在蓬莱仙岛完成朋友聚集仪式',
  '确认 SaBa 帮生日祝福广播正常运行',
]

function HomePage() {
  const featuredProjects = projects.slice(0, 3)

  return (
    <>
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.30),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(248,113,113,0.18),transparent_28%),linear-gradient(180deg,#fff7ed_0%,#ffffff_52%,#f8fafc_100%)]">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(90deg,rgba(251,146,60,0.12)_1px,transparent_1px),linear-gradient(0deg,rgba(251,146,60,0.12)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="pointer-events-none absolute -right-28 top-16 h-72 w-72 rounded-full bg-amber-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-16 h-72 w-72 rounded-full bg-rose-200/50 blur-3xl" />

        <section className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-300/80 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-amber-700 shadow-sm backdrop-blur">
              <span>SaBa Festival Limited</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 tracking-normal text-amber-800">今日限定</span>
            </div>

            <div>
              <p className="text-sm font-semibold tracking-[0.32em] text-orange-500">
                鸡神诞辰 · SaBa帮大会 · 蓬莱仙岛特别开岛
              </p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                欢迎进入
                <span className="block bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 bg-clip-text text-transparent">
                  SaBa节限定首页
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
                今日本站临时切换为蓬莱仙岛庆典模式。鸡神封面图已升格为主视觉，SaBa帮成员将在此完成集结、祝福广播、神秘组件巡礼和一点点完全没有长期维护压力的节日胡闹。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {festivalStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-orange-200 bg-white/75 p-4 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-md"
                >
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-orange-600">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/works"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-600"
              >
                进入作品供奉区
              </Link>
              <Link
                to="/about"
                className="rounded-full border border-orange-300 bg-white/80 px-5 py-3 text-sm font-bold text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-500 hover:bg-orange-50"
              >
                查看节日宣言
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-orange-300/50 via-rose-200/40 to-amber-200/50 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-orange-200 bg-white/85 p-3 shadow-2xl shadow-orange-200/60 backdrop-blur">
              <img
                src="/images/chickenGOD-cover.webp"
                alt="鸡神 SaBa 节限定主视觉"
                className="aspect-[4/3] w-full rounded-[1.5rem] object-cover"
              />
              <div className="absolute left-6 top-6 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-black text-orange-600 shadow-sm backdrop-blur">
                CHICKEN GOD ONLINE
              </div>
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/60 bg-white/85 p-4 shadow-lg backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">今日神谕</p>
                <p className="mt-1 text-lg font-black text-slate-950">SaBa帮的成员和各位来宾聚集在蓬莱仙岛，聆听鸡神的指示。</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr] md:items-stretch">
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-5 shadow-sm sm:p-7">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-700">PengLai Control Panel</p>
            <h2 className="mt-3 text-2xl font-black text-slate-950">蓬莱仙岛今日运行面板</h2>
            <div className="mt-6 space-y-3">
              {festivalRituals.map((ritual, index) => (
                <div key={ritual} className="flex gap-3 rounded-2xl bg-white/80 p-4 shadow-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <p className="leading-7 text-slate-700">{ritual}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {chickenGodImages.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="group overflow-hidden rounded-[1.75rem] border border-orange-200 bg-white p-2 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-100"
              >
                <img
                  src={src}
                  alt={`鸡神封面图 ${index + 1}`}
                  className="aspect-[3/4] w-full rounded-[1.25rem] object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="px-2 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">Chicken GOD #{index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">蓬莱仙岛限定展示位</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <SectionTitle
          eyebrow="Projects"
          title="SaBa帮临时项目巡礼"
          actionText="查看全部 →"
          actionHref="/projects"
        />

        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {featuredProjects.map((project) => (
            <div key={project.title} className="relative">
              <div className="pointer-events-none absolute -right-2 -top-2 z-10 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white shadow-md">
                节日加持
              </div>
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-orange-200 bg-gradient-to-r from-orange-50 via-white to-amber-50">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:gap-6 sm:px-6 sm:py-16 md:grid-cols-2">
          <Link
            to="/works"
            className="group overflow-hidden rounded-[2rem] border border-orange-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:p-8"
          >
            <div className="flex items-center gap-4">
              <img
                src="/images/chickenGOD-cover.webp"
                alt="小说存档节日图标"
                className="h-20 w-20 rounded-2xl object-cover shadow-sm transition group-hover:rotate-3 group-hover:scale-105"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Archive Gate 01</p>
                <h2 className="mt-1 text-xl font-black text-main sm:text-2xl">小说存档 · 神谕卷宗</h2>
              </div>
            </div>
            <p className="mt-5 leading-7 text-muted">
              上传章节、整理目录、展示更新记录。今日额外承担 SaBa 节传说、鸡神神谕与蓬莱仙岛纪事的临时保管职责。
            </p>
          </Link>

          <Link
            to="/works"
            className="group overflow-hidden rounded-[2rem] border border-orange-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:p-8"
          >
            <div className="flex items-center gap-4">
              <img
                src="/images/chickenGOD-cover.webp"
                alt="漫画存档节日图标"
                className="h-20 w-20 rounded-2xl object-cover shadow-sm transition group-hover:-rotate-3 group-hover:scale-105"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Archive Gate 02</p>
                <h2 className="mt-1 text-xl font-black text-main sm:text-2xl">漫画存档 · 鸡神画廊</h2>
              </div>
            </div>
            <p className="mt-5 leading-7 text-muted">
              上传图片、分卷管理、预览阅读，并支持朋友协作更新。今日所有封面均获得鸡神随机祝福光环。
            </p>
          </Link>
        </div>
      </section>
    </>
  )
}

export default HomePage
