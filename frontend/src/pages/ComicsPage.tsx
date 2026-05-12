import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  getComicSeriesList,
  resolveAssetUrl,
  type ComicSeriesListItem,
} from '../api/comics'

function ComicsPage() {
  const [seriesList, setSeriesList] = useState<ComicSeriesListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadSeriesList() {
      try {
        setIsLoading(true)
        setErrorMessage(null)

        const data = await getComicSeriesList()
        setSeriesList(data)
      } catch (error) {
        console.error(error)

        if (error instanceof Error) {
          setErrorMessage(error.message)
        } else {
          setErrorMessage('漫画列表加载失败。')
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadSeriesList()
  }, [])

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
        Comics
      </p>

      <h1 className="mt-2 text-4xl font-bold text-slate-900">漫画存档</h1>

      <p className="mt-5 max-w-3xl leading-7 text-slate-600">
        这里用于整理漫画系列、各部内容、章节更新和设定资料。当前数据来自后端数据库。
      </p>

      {isLoading && (
        <p className="mt-10 text-slate-500">正在加载漫画列表...</p>
      )}

      {errorMessage && (
        <p className="mt-10 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {errorMessage}
        </p>
      )}

      {!isLoading && !errorMessage && seriesList.length === 0 && (
        <p className="mt-10 text-slate-500">暂无漫画系列。</p>
      )}

      {!isLoading && !errorMessage && seriesList.length > 0 && (
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {seriesList.map((series) => {
            const coverUrl = resolveAssetUrl(series.coverUrl)

            return (
              <Link
                key={series.id}
                to={`/works/comics/${series.slug}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={series.title}
                    className="h-64 w-full object-cover"
                  />
                ) : (
                  <div className="h-64 bg-gradient-to-br from-slate-900 to-cyan-700" />
                )}

                <div className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold text-slate-900">
                      {series.title}
                    </h2>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                      {series.status}
                    </span>
                  </div>

                  <p className="mt-4 leading-7 text-slate-600">
                    {series.summary}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ComicsPage
