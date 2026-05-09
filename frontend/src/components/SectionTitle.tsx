import { Link } from 'react-router'

type SectionTitleProps = {
  eyebrow: string
  title: string
  actionText?: string
  actionHref?: string
}

function SectionTitle({ eyebrow, title, actionText, actionHref }: SectionTitleProps) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">{title}</h2>
      </div>

      {actionText && actionHref && (
        <Link
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          to={actionHref}
        >
          {actionText}
        </Link>
      )}
    </div>
  )
}

export default SectionTitle
