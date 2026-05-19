import type { Project } from '../data/projects'

type ProjectCardProps = {
  project: Project
}

function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="surface-card surface-card-link p-6">
      <div
        className={`mb-5 h-36 rounded-xl bg-gradient-to-br ${project.coverClass}`}
      />

      <h3 className="text-xl font-bold text-main">{project.title}</h3>

      <p className="mt-3 text-sm leading-6 text-muted">
        {project.description}
      </p>
    </article>
  )
}

export default ProjectCard
