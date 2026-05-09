import ProjectCard from '../components/ProjectCard'
import SectionTitle from '../components/SectionTitle'
import { projects } from '../data/projects'

function ProjectsPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <SectionTitle
        eyebrow="Projects"
        title="项目实践"
      />

      <p className="mb-8 max-w-3xl leading-7 text-slate-600">
        这里用于整理我的物理计算、机器学习、网站开发和课程项目。后续每个项目可以继续扩展为独立详情页。
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.title} project={project} />
        ))}
      </div>
    </section>
  )
}

export default ProjectsPage
