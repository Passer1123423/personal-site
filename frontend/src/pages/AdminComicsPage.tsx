import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteAdminComicChapter,
  deleteAdminComicPart,
  deleteAdminComicSeries,
  fetchAdminComicsTree,
  type AdminComicSeries,
  uploadAdminComicChapter,
} from "../api/adminComics";

const NEW_OPTION = "__new__";

function AdminComicsPage() {
  const [tree, setTree] = useState<AdminComicSeries[]>([]);
  const [selectedSeriesSlug, setSelectedSeriesSlug] = useState("");
  const [selectedPartSlug, setSelectedPartSlug] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [seriesMode, setSeriesMode] = useState<"existing" | "new">("existing");
  const [partMode, setPartMode] = useState<"existing" | "new">("existing");

  const [newSeriesSlug, setNewSeriesSlug] = useState("");
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [newPartSlug, setNewPartSlug] = useState("");
  const [newPartTitle, setNewPartTitle] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadTree() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchAdminComicsTree();
      setTree(data);

      if (!selectedSeriesSlug && data.length > 0) {
        setSelectedSeriesSlug(data[0].slug);
        if (data[0].parts.length > 0) {
          setSelectedPartSlug(data[0].parts[0].slug);
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "加载失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTree();
  }, []);

  const selectedSeries = useMemo(() => {
    if (seriesMode === "new") {
      return null;
    }

    return tree.find((series) => series.slug === selectedSeriesSlug) ?? null;
  }, [tree, selectedSeriesSlug, seriesMode]);

  const selectedPart = useMemo(() => {
    if (partMode === "new") {
      return null;
    }

    return (
      selectedSeries?.parts.find((part) => part.slug === selectedPartSlug) ??
     null
    );
  }, [selectedSeries, selectedPartSlug, partMode]);

  const newSeriesSlugExists = useMemo(() => {
    if (seriesMode !== "new") {
      return false;
    }

    return tree.some((series) => series.slug === newSeriesSlug.trim());
  }, [tree, seriesMode, newSeriesSlug]);

  const newPartSlugExists = useMemo(() => {
    if (partMode !== "new" || seriesMode !== "existing" || !selectedSeries) {
      return false;
    }

    return selectedSeries.parts.some(
      (part) => part.slug === newPartSlug.trim()
    );
  }, [partMode, seriesMode, selectedSeries, newPartSlug]);

  function handleSeriesChange(value: string) {
    if (value === NEW_OPTION) {
      setSeriesMode("new");
      setSelectedSeriesSlug("");
      setPartMode("new");
      setSelectedPartSlug("");
      return;
    }

    setSeriesMode("existing");
    setSelectedSeriesSlug(value);

    const nextSeries = tree.find((series) => series.slug === value);
    const firstPart = nextSeries?.parts[0];

    setPartMode("existing");
    setSelectedPartSlug(firstPart?.slug ?? "");
  }

  function handlePartChange(value: string) {
    if (value === NEW_OPTION) {
      setPartMode("new");
      setSelectedPartSlug("");
      return;
    }

    setPartMode("existing");
    setSelectedPartSlug(value);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    setFiles(selectedFiles);
  }

  async function handleUpload(event: React.FormEvent) {
    const finalSeriesSlug =
    seriesMode === "new" ? newSeriesSlug.trim() : selectedSeriesSlug;

    const finalPartSlug =
    partMode === "new" ? newPartSlug.trim() : selectedPartSlug;

    const existingSeries = tree.find(
      (series) => series.slug === finalSeriesSlug
    );

    if (seriesMode === "new" && existingSeries) {
      setErrorMessage(
        `series slug "${finalSeriesSlug}" 已存在。请切回已有 series，或换一个新 slug。`
      );
      return;
    }

    if (partMode === "new" && seriesMode === "existing" && selectedSeries) {
      const existingPart = selectedSeries.parts.find(
        (part) => part.slug === finalPartSlug
      );

      if (existingPart) {
        setErrorMessage(
          `part slug "${finalPartSlug}" 已存在。请切回已有 part，或换一个新 slug。`
        );
        return;
      }
    }

    event.preventDefault();

    if (!finalSeriesSlug) {
      setErrorMessage("请选择或填写 series slug。");
      return;
    }

    if (seriesMode === "new" && !newSeriesTitle.trim()) {
      setErrorMessage("可选。");
    }

    if (!finalPartSlug) {
      setErrorMessage("请选择或填写 part slug。");
      return;
    }

    if (partMode === "new" && !newPartTitle.trim()) {
      setErrorMessage("可选。");
    }

    if (partMode === "existing" && !selectedPart) {
      setErrorMessage("当前选择的 part 不存在。");
      return;
    }

    if (files.length === 0) {
      setErrorMessage("请选择要上传的图片。");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      await uploadAdminComicChapter({
        seriesSlug: finalSeriesSlug,
        partSlug: finalPartSlug,
        chapterTitle,
        seriesTitle: seriesMode === "new" ? newSeriesTitle : undefined,
        partTitle: partMode === "new" ? newPartTitle : undefined,
        files,
      });

      setNewSeriesSlug("");
      setNewSeriesTitle("");
      setNewPartSlug("");
      setNewPartTitle("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setChapterTitle("");
      setFiles([]);
      await loadTree();
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteChapter(
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string
  ) {
    const confirmed = window.confirm(
      `确认删除 ${seriesSlug}/${partSlug}/${chapterSlug} 吗？`
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      await deleteAdminComicChapter({
        seriesSlug,
        partSlug,
        chapterSlug,
      });

      await loadTree();
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePart(seriesSlug: string, partSlug: string) {
    const input = window.prompt(
      `删除 part 会删除其下所有章节、页面和图片文件。\n\n确认删除请输入 ${partSlug}`
    );

    if (input === null){
      return;
    }

    if (input !== partSlug) {
      setSuccessMessage("");
      setErrorMessage("输入slug错误，请检查后重新输入");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      await deleteAdminComicPart({
        seriesSlug,
        partSlug,
      });

      setErrorMessage("");
      setSuccessMessage(`已删除 part：${seriesSlug}/${partSlug}`);
      await loadTree();
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "删除 part 失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSeries(seriesSlug: string) {
    const input = window.prompt(
      `删除 series 会删除其下所有 part、chapter、页面和图片文件。\n\n确认删除请输入 ${seriesSlug}`
    );

    if (input === null){
      return;
    }

    if (input !== seriesSlug) {
      setSuccessMessage("");
      setErrorMessage("输入slug错误，请检查后重新输入");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      await deleteAdminComicSeries({
        seriesSlug,
      });

      setErrorMessage("");
      setSuccessMessage(`已删除 series：${seriesSlug}`);
      await loadTree();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "删除 series 失败。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl p-6">正在加载后台数据...</main>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <section>
        <h1 className="text-2xl font-bold">漫画后台管理</h1>
        <p className="mt-2 text-slate-600">
          当前页面用于本地上传新章节和删除测试章节。
        </p>
      </section>

      {errorMessage && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </section>
      )}

      {successMessage && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
          {successMessage}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold">上传新章节</h2>

        <form onSubmit={handleUpload} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">选择 series</label>
            <select
              value={seriesMode === "new" ? NEW_OPTION : selectedSeriesSlug}
              onChange={(event) => handleSeriesChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {tree.map((series) => (
                <option key={series.id} value={series.slug}>
                  {series.title} ({series.slug})
                </option>
              ))}
              <option value={NEW_OPTION}>+ 新建 series</option>
            </select>

            {seriesMode === "new" && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  value={newSeriesSlug}
                  onChange={(event) => setNewSeriesSlug(event.target.value)}
                  placeholder="新 series slug，例如 new-comic"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  value={newSeriesTitle}
                  onChange={(event) => setNewSeriesTitle(event.target.value)}
                  placeholder="新 series 标题"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />

                {newSeriesSlugExists && (
                  <p className="mt-2 text-sm text-red-600">
                    这个 series slug 已存在，请切回已有 series 或换一个 slug。
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">选择 part</label>
            <select
              value={partMode === "new" ? NEW_OPTION : selectedPartSlug}
              onChange={(event) => handlePartChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {selectedSeries?.parts.map((part) => (
                <option key={part.id} value={part.slug}>
                  {part.title} ({part.slug})
                </option>
              ))}
              <option value={NEW_OPTION}>+ 新建 part</option>
            </select>

            {partMode === "new" && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  value={newPartSlug}
                  onChange={(event) => setNewPartSlug(event.target.value)}
                  placeholder="新 part slug，例如 part-01"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  value={newPartTitle}
                  onChange={(event) => setNewPartTitle(event.target.value)}
                  placeholder="新 part 标题"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />

                {newPartSlugExists && (
                  <p className="mt-2 text-sm text-red-600">
                    这个 part slug 已存在，请切回已有 part 或换一个 slug。
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">章节标题</label>
            <input
              value={chapterTitle}
              onChange={(event) => setChapterTitle(event.target.value)}
              placeholder="例如：第8话 测试章节"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">选择图片</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
              >
                选择图片
              </button>

              <span className="text-sm text-slate-500">
                {files.length === 0
                  ? "未选择图片，可按 Ctrl / Shift 多选"
                  : `已选择 ${files.length} 张图片`}
              </span>
            </div>
          </div>

          {files.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-medium">待上传图片顺序</p>
              <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm text-slate-700">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}>{file.name}</li>
                ))}
              </ol>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "处理中..." : "上传并创建章节"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold">当前漫画结构</h2>

        {tree.length === 0 ? (
          <p className="mt-4 text-slate-500">暂无漫画数据。</p>
        ) : (
          <div className="mt-4 space-y-6">
            {tree.map((series) => (
              <div key={series.id} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    {series.title} ({series.slug})
                  </h3>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDeleteSeries(series.slug)}
                    className="rounded-lg border border-red-400 px-3 py-1 text-sm text-red-700 disabled:opacity-50"
                  >
                    删除 series
                  </button>
                </div>

                <div className="mt-3 space-y-4">
                  {series.parts.length === 0 ? (
                    <p className="text-sm text-slate-500">暂无 part。</p>
                  ) : (
                    series.parts.map((part) => (
                      <div
                        key={part.id}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-medium">
                            {part.title} ({part.slug})
                          </h4>

                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleDeletePart(series.slug, part.slug)}
                            className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 disabled:opacity-50"
                          >
                            删除 part
                          </button>
                        </div>

                        {part.chapters.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-500">
                            暂无 chapter。
                          </p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {part.chapters.map((chapter) => (
                              <div
                                key={chapter.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                              >
                                <div>
                                  <p className="font-medium">
                                    {chapter.displayOrder}. {chapter.title}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    {chapter.slug} · {chapter.pageCount} 页
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() =>
                                    handleDeleteChapter(
                                      series.slug,
                                      part.slug,
                                      chapter.slug
                                    )
                                  }
                                  className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 disabled:opacity-50"
                                >
                                  删除
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminComicsPage;
