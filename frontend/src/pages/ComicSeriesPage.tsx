import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  getComicSeriesDetail,
  resolveAssetUrl,
  type ComicSeriesDetail,
} from '../api/comics'

function ComicSeriesPage() {
  const { seriesSlug } = useParams()

  const [series, setSeries] = useState<ComicSeriesDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadSeriesDetail() {
      if (!seriesSlug) {
        setErrorMessage('缺少漫画系列参数。')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setErrorMessage(null)

        const data = await getComicSeriesDetail(seriesSlug)
        setSeries(data)
      } catch (error) {
        console.error(error)
        setErrorMessage('漫画详情加载失败，请确认后端服务是否正在运行。')
      } finally {
        setIsLoading(false)
      }
    }

    loadSeriesDetail()
  }, [seriesSlug])

  if (isLoading) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-slate-500">正在加载漫画详情...</p>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {errorMessage}
        </p>
      </section>
    )
  }

  if (!series) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-slate-500">未找到漫画系列。</p>
      </section>
    )
  }

  const coverUrl = resolveAssetUrl(series.coverUrl)

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <Link
        to="/works/comics"
        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        ← 返回漫画存档
      </Link>

      <div className="mt-8 grid gap-8 md:grid-cols-[320px_1fr]">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={series.title}
            className="h-80 w-full rounded-2xl object-cover shadow-sm"
          />
        ) : (
          <div className="h-80 rounded-2xl bg-gradient-to-br from-slate-900 to-cyan-700 shadow-sm" />
        )}

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            Comic Series
          </p>

          <h1 className="mt-2 text-4xl font-bold text-slate-900">
            {series.title}
          </h1>

          <p className="mt-5 leading-7 text-slate-600">{series.summary}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              {series.status}
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {series.visibility}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-12 space-y-6">
        {series.parts.length > 0 ? (
          series.parts.map((part) => {
            const partCoverUrl = resolveAssetUrl(part.coverUrl)

            return (
              <article
                key={part.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="grid gap-0 md:grid-cols-[260px_1fr]">
                  {partCoverUrl ? (
                    <img
                      src={partCoverUrl}
                      alt={part.title}
                      className="h-64 w-full object-cover md:h-full"
                    />
                  ) : (
                    <div className="h-64 bg-gradient-to-br from-slate-900 to-blue-700 md:h-full" />
                  )}

                  <div className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold text-slate-900">
                        {part.title}
                      </h2>

                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                        {part.status}
                      </span>
                    </div>

                    {part.summary && (
                      <p className="mt-4 leading-7 text-slate-600">
                        {part.summary}
                      </p>
                    )}

                    <div className="mt-6 flex flex-wrap gap-3">
                      {part.chapters.length > 0 ? (
                        part.chapters.map((chapter) => (
                          <Link
                            key={chapter.id}
                            to={`/works/comics/${series.slug}/${part.slug}/${chapter.slug}`}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600"
                          >
                            {chapter.title}
                          </Link>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">暂无章节</span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        ) : (
          <p className="text-slate-500">暂无分部。</p>
        )}
      </div>
    </section>
  )
}

export default ComicSeriesPage
