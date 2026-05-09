function AboutPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
        About
      </p>

      <h1 className="mt-2 text-4xl font-bold text-slate-900">关于我</h1>

      <div className="mt-8 max-w-3xl space-y-5 leading-8 text-slate-600">
        <p>
          这里可以放个人介绍、研究兴趣、项目方向、联系方式和网站说明。
        </p>

        <p>
          当前网站先作为个人项目展示与作品整理平台，后续会逐步加入后端上传、文件下载、权限管理等功能。
        </p>
      </div>
    </section>
  )
}

export default AboutPage
