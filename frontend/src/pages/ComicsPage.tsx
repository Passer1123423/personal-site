import { comicSeries } from '../data/comics'

function ComicsPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
        Comics
      </p>

      <h1 className="mt-2 text-4xl font-bold text-slate-900">漫画存档</h1>

      <p className="mt-5 max-w-3xl leading-7 text-slate-600">
        这里用于整理漫画系列、各部内容、章节更新和设定资料。当前先按“系列 - 部”的结构展示，后续再接入上传、预览和下载功能。
      </p>

      <div className="mt-10 space-y-8">
        {comicSeries.map((series) => (
          <article
            key={series.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="grid gap-6 md:grid-cols-[280px_1fr]">
              <div
                className={`h-56 rounded-xl bg-gradient-to-br md:h-full ${series.coverClass}`}
              />

              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {series.title}
                </h2>

                <p className="mt-4 leading-7 text-slate-600">
                  {series.description}
                </p>

                <div className="mt-6 space-y-4">
                  {series.parts.map((part) => (
                    <div
                      key={part.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-slate-900">
                          {part.title}
                        </h3>

                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                          {part.status}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {part.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {part.chapters.length > 0 ? (
                          part.chapters.map((chapter) => (
                            <button
                              key={chapter.id}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600"
                            >
                              {chapter.title}
                            </button>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">
                            暂无章节
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ComicsPage
