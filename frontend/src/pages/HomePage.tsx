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

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <SectionTitle
          eyebrow="Projects"
          title="假装项目"
          actionText="查看全部 →"
          actionHref="/projects"
        />

        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {featuredProjects.map((project) => (
            <ProjectCard key={project.title} project={project} />
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:gap-6 sm:px-6 sm:py-16 md:grid-cols-2">
          <Link
            to="/saba-note"
            className="surface-card surface-card-link p-5 sm:p-8"
          >
            <h2 className="text-xl font-bold text-main sm:text-2xl">笔记功能</h2>
            <p className="mt-4 leading-7 text-muted">
              尝试一下Saba-note！把它当作外存，随时记录一切。
            </p>
          </Link>

          <Link
            to="/works"
            className="surface-card surface-card-link p-5 sm:p-8"
          >
            <h2 className="text-xl font-bold text-main sm:text-2xl">摸鱼存档</h2>
            <p className="mt-4 leading-7 text-muted">
              上传图片、分卷管理、预览阅读。
            </p>
          </Link>
        </div>
      </section>
    </>
  )
}

export default HomePage
