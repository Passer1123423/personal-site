import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  getComicReaderData,
  resolveAssetUrl,
  type ComicReaderData,
} from '../api/comics'

function ComicReaderPage() {
  const { seriesSlug, partSlug, chapterSlug } = useParams()

  const [readerData, setReaderData] = useState<ComicReaderData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadReaderData() {
      if (!seriesSlug || !partSlug || !chapterSlug) {
        setErrorMessage('缺少漫画阅读参数。')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setErrorMessage(null)

        const data = await getComicReaderData(seriesSlug, partSlug, chapterSlug)
        setReaderData(data)
      } catch (error) {
        console.error(error)
        setErrorMessage('漫画章节加载失败，请确认后端服务是否正在运行。')
      } finally {
        setIsLoading(false)
      }
    }

    loadReaderData()
  }, [seriesSlug, partSlug, chapterSlug])

  if (isLoading) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-slate-500">正在加载漫画章节...</p>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {errorMessage}
        </p>
      </section>
    )
  }

  if (!readerData) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-slate-500">未找到漫画章节。</p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <Link
        to={`/works/comics/${readerData.series.slug}`}
        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        ← 返回 {readerData.series.title}
      </Link>

      <div className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
          Comic Reader
        </p>

        <h1 className="mt-2 text-4xl font-bold text-slate-900">
          {readerData.chapter.title}
        </h1>

        <p className="mt-4 text-slate-500">
          {readerData.series.title} / {readerData.part.title} / 共{' '}
          {readerData.pageCount} 页
        </p>

        {readerData.chapter.summary && (
          <p className="mt-5 leading-7 text-slate-600">
            {readerData.chapter.summary}
          </p>
        )}
      </div>

      <div className="mt-10 space-y-6">
        {readerData.pages.length > 0 ? (
          readerData.pages.map((page) => {
            const imageUrl = resolveAssetUrl(page.imageUrl)

            if (!imageUrl) {
              return (
                <div
                  key={page.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400"
                >
                  第 {page.displayOrder} 页图片缺失
                </div>
              )
            }

            return (
              <img
                key={page.id}
                src={imageUrl}
                alt={`第 ${page.displayOrder} 页`}
                className="w-full rounded-xl bg-white shadow-sm"
              />
            )
          })
        ) : (
          <p className="text-slate-500">这一章暂无页面。</p>
        )}
      </div>
    </section>
  )
}

export default ComicReaderPage
