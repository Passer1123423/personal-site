export type ComicChapter = {
  id: string
  title: string
  description?: string
  updatedAt?: string
}

export type ComicPart = {
  id: string
  title: string
  description: string
  status: '连载中' | '已完结' | '筹备中'
  chapters: ComicChapter[]
}

export type ComicSeries = {
  id: string
  title: string
  description: string
  coverClass: string
  parts: ComicPart[]
}

export const comicSeries: ComicSeries[] = [
  {
    id: 'example-series-01',
    title: '漫画系列 01',
    description: '这里放整个系列的简介，例如世界观、主线设定、角色关系或创作说明。',
    coverClass: 'from-slate-900 to-blue-700',
    parts: [
      {
        id: 'part-01',
        title: '第一部',
        description: '第一部的简介。可以写故事开端、主要角色和当前更新状态。',
        status: '筹备中',
        chapters: [
          {
            id: 'chapter-01',
            title: '第 1 话',
            description: '章节简介或备注。',
            updatedAt: '2026-05-09',
          },
          {
            id: 'chapter-02',
            title: '第 2 话',
            description: '后续更新占位。',
          },
        ],
      },
      {
        id: 'part-02',
        title: '第二部',
        description: '第二部的简介。当前只是占位，后面可以继续扩展。',
        status: '筹备中',
        chapters: [],
      },
    ],
  },
  {
    id: 'example-series-02',
    title: '漫画系列 02',
    description: '可以用于短篇集、番外篇、设定集或朋友协作作品。',
    coverClass: 'from-slate-900 to-cyan-700',
    parts: [
      {
        id: 'short-stories',
        title: '短篇集',
        description: '收录短篇漫画或实验性作品。',
        status: '筹备中',
        chapters: [],
      },
    ],
  },
]
