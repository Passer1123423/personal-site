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
        <a
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          href={actionHref}
        >
          {actionText}
        </a>
      )}
    </div>
  )
}

export default SectionTitle
