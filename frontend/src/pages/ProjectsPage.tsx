import ProjectCard from "../components/ProjectCard";
import SectionTitle from "../components/SectionTitle";
import { projects } from "../data/projects";

function ProjectsPage() {
  return (
    <section className="relative overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(255,247,237,1),rgba(254,243,199,0.72),rgba(255,237,213,1))]" />
      <div className="pointer-events-none absolute left-8 top-12 h-56 w-56 rounded-full bg-orange-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-72 w-72 rounded-full bg-yellow-300/20 blur-3xl" />

      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="rounded-[2rem] border border-orange-200 bg-white/78 p-6 shadow-[0_24px_70px_rgba(154,52,18,0.12)] backdrop-blur md:p-8">
            <SectionTitle
              eyebrow="SaBa Festival Projects"
              title="项目实践 · 临时神殿版"
            />

            <p className="mt-5 max-w-3xl leading-7 text-muted">
              GPT 原本说这里用于整理物理计算、网站开发和课程项目。今天全部临时改名为
              SaBa 帮技术神兵陈列馆：每一个项目都是一次召唤，每一次 build
              通过都是鸡神显灵。
            </p>

            <div className="mt-6 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <p className="font-black text-main">部署法阵</p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Git、Nginx、FastAPI 与 Vite 在此共同维持仙岛结界。
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-black text-main">物理祭器</p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  公式、数据、图像与实验报告全部获得节日滤镜。
                </p>
              </div>

              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                <p className="font-black text-main">SaBa 变量</p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  所有暂时无法解释的灵感，先记为 SaBa 常数。
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-orange-200 bg-gradient-to-br from-orange-100 via-yellow-50 to-white p-6 shadow-[0_24px_70px_rgba(154,52,18,0.14)]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-yellow-300/35 blur-2xl" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.26em] text-orange-600">
                  Chicken GOD Console
                </p>
                <h2 className="mt-3 text-2xl font-black text-main">
                  今日项目运行状态
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  这不是普通项目页，这是鸡神和 SaBa 帮共同批准的临时控制台。
                </p>
              </div>

              <div className="mx-auto w-full max-w-[260px]">
                <img
                  src="/images/chickenGOD-cover.webp"
                  alt="鸡神节日限定图"
                  className="h-full w-full object-contain drop-shadow-2xl"
                  decoding="async"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-bold text-orange-900">
                <div className="rounded-2xl bg-white/75 p-3">
                  分支
                  <br />
                  <span className="text-orange-500">event/saba</span>
                </div>
                <div className="rounded-2xl bg-white/75 p-3">
                  合并策略
                  <br />
                  <span className="text-orange-500">绝不长期化</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] border border-orange-200 bg-white/72 p-4 shadow-[0_18px_50px_rgba(154,52,18,0.1)] backdrop-blur md:p-6">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-orange-600">
                Project Relics
              </p>
              <h2 className="mt-2 text-2xl font-black text-main">
                SaBa 帮技术遗物陈列区
              </h2>
            </div>

            <p className="max-w-xl text-sm leading-6 text-muted">
              下方仍然读取原来的项目数据，只是外层被临时节日化。长期项目内容不被污染。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.title}
                className="rounded-[1.5rem] border border-orange-100 bg-gradient-to-br from-white to-orange-50/80 p-1 shadow-[0_12px_36px_rgba(154,52,18,0.08)]"
              >
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[2rem] border border-orange-200 bg-orange-100/70 p-6">
            <p className="text-lg font-black text-main">鸡神批准</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              所有项目暂时获得“可以乱写节日说明但不改核心逻辑”的许可。
            </p>
          </div>

          <div className="rounded-[2rem] border border-yellow-200 bg-yellow-100/70 p-6">
            <p className="text-lg font-black text-main">SaBa 归档</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              本页视觉效果只属于今天，活动结束可以整分支删除。
            </p>
          </div>

          <div className="rounded-[2rem] border border-amber-200 bg-amber-100/70 p-6">
            <p className="text-lg font-black text-main">蓬莱仙岛</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              服务器若能成功 build，即视为仙岛结界稳定。
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

export default ProjectsPage;