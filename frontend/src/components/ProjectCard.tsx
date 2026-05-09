import type { Project } from '../data/projects'

type ProjectCardProps = {
  project: Project
}

function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div
        className={`mb-5 h-36 rounded-xl bg-gradient-to-br ${project.coverClass}`}
      />

      <h3 className="text-xl font-bold text-slate-900">{project.title}</h3>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {project.description}
      </p>
    </article>
  )
}

export default ProjectCard
