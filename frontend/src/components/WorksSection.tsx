function WorksSection() {
  return (
    <section id="works" className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2">
        <div className="surface-card p-8">
          <h2 className="text-2xl font-bold text-main">小说存档</h2>
          <p className="mt-4 leading-7 text-muted">
            后续用于上传章节、整理目录、展示更新记录，并支持下载。
          </p>
        </div>

        <div className="surface-card p-8">
          <h2 className="text-2xl font-bold text-main">漫画存档</h2>
          <p className="mt-4 leading-7 text-muted">
            后续用于上传图片、分卷管理、预览阅读，并支持朋友协作更新。
          </p>
        </div>
      </div>
    </section>
  )
}

export default WorksSection
