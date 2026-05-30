import { projects } from '../data/projects'
import ProjectCard from './ProjectCard'
import SectionTitle from './SectionTitle'

function ProjectsSection() {
  return (
    <section id="projects" className="mx-auto max-w-6xl px-6 py-16">
      <SectionTitle
        eyebrow="Projects"
        title="假装项目"
        actionText="查看全部 →"
        actionHref="#projects"
      />

      <div className="grid gap-6 md:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.title} project={project} />
        ))}
      </div>
    </section>
  )
}

export default ProjectsSection
