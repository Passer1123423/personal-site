import Hero from '../components/Hero'
import ProjectCard from '../components/ProjectCard'
import SectionTitle from '../components/SectionTitle'
import { projects } from '../data/projects'
import { Link } from 'react-router'

function HomePage() {
  const featuredProjects = projects.slice(0, 3)

  return (
    <>
      <Hero />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionTitle
          eyebrow="Projects"
          title="假装项目"
          actionText="查看全部 →"
          actionHref="/projects"
        />

        <div className="grid gap-6 md:grid-cols-3">
          {featuredProjects.map((project) => (
            <ProjectCard key={project.title} project={project} />
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2">
          <Link
            to="/works"
            className="surface-card surface-card-link p-8"
          >
            <h2 className="text-2xl font-bold text-main">小说存档</h2>
            <p className="mt-4 leading-7 text-muted">
              上传章节、整理目录、展示更新记录，并支持后续下载。
            </p>
          </Link>

          <Link
            to="/works"
            className="surface-card surface-card-link p-8"
          >
            <h2 className="text-2xl font-bold text-main">漫画存档</h2>
            <p className="mt-4 leading-7 text-muted">
              上传图片、分卷管理、预览阅读，并支持朋友协作更新。
            </p>
          </Link>
        </div>
      </section>
    </>
  )
}

export default HomePage
