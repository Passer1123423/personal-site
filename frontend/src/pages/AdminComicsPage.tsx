import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from "react";
import {
  deleteAdminComicChapter,
  deleteAdminComicPart,
  deleteAdminComicSeries,
  fetchAdminComicsTree,
  moveAdminComicChapter,
  renameAdminComicChapter,
  renameAdminComicPart,
  renameAdminComicSeries,
  type AdminComicSeries,
  uploadAdminComicChapter,
  fetchAdminComicOwnerCandidates,
  setAdminComicPartOwner,
  type AdminComicOwner,
} from "../api/adminComics";

import { useNavigate } from "react-router-dom";
import { clearAccessToken, getMe } from "../api/auth";

const NEW_OPTION = "__new__";

type AdminComicPart = AdminComicSeries["parts"][number];
type AdminComicChapter = AdminComicPart["chapters"][number];
type SelectMode = "existing" | "new";
type MoveDirection = "up" | "down";

function MessageArea({
  errorMessage,
  successMessage,
}: {
  errorMessage: string;
  successMessage: string;
}) {
  return (
    <>
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
    </>
  );
}

function EditableTitle({
  value,
  disabled,
  onSave,
  inputClassName = "",
}: {
  value: string;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
  inputClassName?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  function startEdit() {
    if (disabled) {
      return;
    }

    setDraftValue(value);
    setIsEditing(true);
  }

  function cancelEdit() {
    setDraftValue(value);
    setIsEditing(false);
  }

  async function saveEdit() {
    await onSave(draftValue);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-2">
        <input
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              saveEdit();
            }

            if (event.key === "Escape") {
              cancelEdit();
            }
          }}
          className={`rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 outline-none focus:border-blue-400 ${inputClassName}`}
          autoFocus
        />

        <button
          type="button"
          onClick={saveEdit}
          disabled={disabled}
          className="rounded-md border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
          title="保存"
        >
          ✓
        </button>

        <button
          type="button"
          onClick={cancelEdit}
          disabled={disabled}
          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          title="取消"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={disabled}
      className="group inline-flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      title="点击重命名"
    >
      <span className="group-hover:underline">{value || ""}</span>
      <span className="text-xs text-slate-400 transition group-hover:text-slate-600">
        ✎
      </span>
    </button>
  );
}

function getChapterCustomTitle(chapter: AdminComicChapter): string {
  const prefixPattern = new RegExp(`^第\\s*${chapter.displayOrder}\\s*话\\s*`);
  return chapter.title.replace(prefixPattern, "");
}

function UploadChapterForm({
  tree,
  selectedSeries,
  selectedPart,
  selectedSeriesSlug,
  selectedPartSlug,
  seriesMode,
  partMode,
  newSeriesSlug,
  newSeriesTitle,
  newPartSlug,
  newPartTitle,
  chapterTitle,
  files,
  submitting,
  newSeriesSlugExists,
  newPartSlugExists,
  fileInputRef,
  onSeriesChange,
  onPartChange,
  onNewSeriesSlugChange,
  onNewSeriesTitleChange,
  onNewPartSlugChange,
  onNewPartTitleChange,
  onChapterTitleChange,
  onFileChange,
  onSubmit,
}: {
  tree: AdminComicSeries[];
  selectedSeries: AdminComicSeries | null;
  selectedPart: AdminComicPart | null;
  selectedSeriesSlug: string;
  selectedPartSlug: string;
  seriesMode: SelectMode;
  partMode: SelectMode;
  newSeriesSlug: string;
  newSeriesTitle: string;
  newPartSlug: string;
  newPartTitle: string;
  chapterTitle: string;
  files: File[];
  submitting: boolean;
  newSeriesSlugExists: boolean;
  newPartSlugExists: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSeriesChange: (value: string) => void;
  onPartChange: (value: string) => void;
  onNewSeriesSlugChange: (value: string) => void;
  onNewSeriesTitleChange: (value: string) => void;
  onNewPartSlugChange: (value: string) => void;
  onNewPartTitleChange: (value: string) => void;
  onChapterTitleChange: (value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-semibold">上传新章节</h2>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium">选择 series</label>
          <select
            value={seriesMode === "new" ? NEW_OPTION : selectedSeriesSlug}
            onChange={(event) => onSeriesChange(event.target.value)}
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
            <div className="mt-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={newSeriesSlug}
                  onChange={(event) => onNewSeriesSlugChange(event.target.value)}
                  placeholder="新 series slug，例如 new-comic"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  value={newSeriesTitle}
                  onChange={(event) => onNewSeriesTitleChange(event.target.value)}
                  placeholder="新 series 标题，可留空"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

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
            onChange={(event) => onPartChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {selectedSeries?.parts.map((part) => (
              <option key={part.id} value={part.slug}>
                {part.title} ({part.slug})
              </option>
            ))}
            <option value={NEW_OPTION}>+ 新建 part</option>
          </select>

          {selectedPart && (
            <p className="mt-1 text-sm text-slate-500">
              当前选择：{selectedPart.title} ({selectedPart.slug})
            </p>
          )}

          {partMode === "new" && (
            <div className="mt-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={newPartSlug}
                  onChange={(event) => onNewPartSlugChange(event.target.value)}
                  placeholder="新 part slug，例如 part-01"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  value={newPartTitle}
                  onChange={(event) => onNewPartTitleChange(event.target.value)}
                  placeholder="新 part 标题，可留空"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

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
            onChange={(event) => onChapterTitleChange(event.target.value)}
            placeholder="例如：测试章节；可留空"
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
            onChange={onFileChange}
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
  );
}

function ComicTreeView({
  tree,
  submitting,
  onRenameSeries,
  onRenamePart,
  onRenameChapter,
  onDeleteSeries,
  onDeletePart,
  onMoveChapter,
  onDeleteChapter,
  ownerCandidates,
  onSetPartOwner,
}: {
  tree: AdminComicSeries[];
  submitting: boolean;
  onRenameSeries: (seriesSlug: string, title: string) => Promise<void>;
  onRenamePart: (
    seriesSlug: string,
    partSlug: string,
    title: string
  ) => Promise<void>;
  onRenameChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    customTitle: string
  ) => Promise<void>;
  onDeleteSeries: (seriesSlug: string) => void;
  onDeletePart: (seriesSlug: string, partSlug: string) => void;
  onMoveChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    direction: MoveDirection
  ) => void;
  onDeleteChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string
  ) => void;
  ownerCandidates: AdminComicOwner[];
  onSetPartOwner: (
    seriesSlug: string,
    partSlug: string,
    username: string | null
  ) => Promise<void>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-semibold">当前漫画结构</h2>

      {tree.length === 0 ? (
        <p className="mt-4 text-slate-500">暂无漫画数据。</p>
      ) : (
        <div className="mt-4 space-y-6">
          {tree.map((series) => (
            <SeriesBlock
              key={series.id}
              series={series}
              submitting={submitting}
              onRenameSeries={onRenameSeries}
              onRenamePart={onRenamePart}
              onRenameChapter={onRenameChapter}
              onDeleteSeries={onDeleteSeries}
              onDeletePart={onDeletePart}
              onMoveChapter={onMoveChapter}
              onDeleteChapter={onDeleteChapter}
              ownerCandidates={ownerCandidates}
              onSetPartOwner={onSetPartOwner}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SeriesBlock({
  series,
  submitting,
  onRenameSeries,
  onRenamePart,
  onRenameChapter,
  onDeleteSeries,
  onDeletePart,
  onMoveChapter,
  onDeleteChapter,
  ownerCandidates,
  onSetPartOwner,
}: {
  series: AdminComicSeries;
  submitting: boolean;
  onRenameSeries: (seriesSlug: string, title: string) => Promise<void>;
  onRenamePart: (
    seriesSlug: string,
    partSlug: string,
    title: string
  ) => Promise<void>;
  onRenameChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    customTitle: string
  ) => Promise<void>;
  onDeleteSeries: (seriesSlug: string) => void;
  onDeletePart: (seriesSlug: string, partSlug: string) => void;
  onMoveChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    direction: MoveDirection
  ) => void;
  onDeleteChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string
  ) => void;
  ownerCandidates: AdminComicOwner[];
  onSetPartOwner: (
    seriesSlug: string,
    partSlug: string,
    username: string | null
  ) => Promise<void>;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">
          <EditableTitle
            value={series.title}
            disabled={submitting}
            onSave={(title) => onRenameSeries(series.slug, title)}
          />{" "}
          <span className="text-slate-500">({series.slug})</span>
        </h3>

        <button
          type="button"
          disabled={submitting}
          onClick={() => onDeleteSeries(series.slug)}
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
            <PartBlock
              key={part.id}
              seriesSlug={series.slug}
              part={part}
              submitting={submitting}
              onRenamePart={onRenamePart}
              onRenameChapter={onRenameChapter}
              onDeletePart={onDeletePart}
              onMoveChapter={onMoveChapter}
              onDeleteChapter={onDeleteChapter}
              ownerCandidates={ownerCandidates}
              onSetPartOwner={onSetPartOwner}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PartBlock({
  seriesSlug,
  part,
  submitting,
  onRenamePart,
  onRenameChapter,
  onDeletePart,
  onMoveChapter,
  onDeleteChapter,
  ownerCandidates,
  onSetPartOwner,
}: {
  seriesSlug: string;
  part: AdminComicPart;
  submitting: boolean;
  onRenamePart: (
    seriesSlug: string,
    partSlug: string,
    title: string
  ) => Promise<void>;
  onRenameChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    customTitle: string
  ) => Promise<void>;
  onDeletePart: (seriesSlug: string, partSlug: string) => void;
  onMoveChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    direction: MoveDirection
  ) => void;
  onDeleteChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string
  ) => void;
  ownerCandidates: AdminComicOwner[];
  onSetPartOwner: (
    seriesSlug: string,
    partSlug: string,
    username: string | null
  ) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-medium">
            <EditableTitle
              value={part.title}
              disabled={submitting}
              onSave={(title) => onRenamePart(seriesSlug, part.slug, title)}
            />{" "}
            <span className="text-slate-500">({part.slug})</span>
          </h4>

          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>owner</span>
            <select
              value={part.owner?.username ?? ""}
              onChange={(event) =>
                onSetPartOwner(
                  seriesSlug,
                  part.slug,
                  event.target.value || null,
                )
              }
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:border-blue-400 disabled:opacity-60"
            >
              <option value="">未指定</option>
              {ownerCandidates.map((user) => (
                <option key={user.id} value={user.username}>
                  {user.displayName} (@{user.username}, {user.role})
                </option>
              ))}
            </select>
          </div>
        </div>



        <button
          type="button"
          disabled={submitting}
          onClick={() => onDeletePart(seriesSlug, part.slug)}
          className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 disabled:opacity-50"
        >
          删除 part
        </button>
      </div>

      {part.chapters.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">暂无 chapter。</p>
      ) : (
        <div className="mt-2 space-y-2">
          {part.chapters.map((chapter) => (
            <ChapterRow
              key={chapter.id}
              seriesSlug={seriesSlug}
              partSlug={part.slug}
              chapter={chapter}
              submitting={submitting}
              onRenameChapter={onRenameChapter}
              onMoveChapter={onMoveChapter}
              onDeleteChapter={onDeleteChapter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChapterRow({
  seriesSlug,
  partSlug,
  chapter,
  submitting,
  onRenameChapter,
  onMoveChapter,
  onDeleteChapter,
}: {
  seriesSlug: string;
  partSlug: string;
  chapter: AdminComicChapter;
  submitting: boolean;
  onRenameChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    customTitle: string
  ) => Promise<void>;
  onMoveChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    direction: MoveDirection
  ) => void;
  onDeleteChapter: (
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string
  ) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <div>
        <p className="font-medium">
          <span className="mr-2 text-slate-500">{chapter.displayOrder}.</span>
          <span className="mr-1 text-slate-500">第{chapter.displayOrder}话</span>
          <EditableTitle
            value={getChapterCustomTitle(chapter)}
            disabled={submitting}
            onSave={(customTitle) =>
              onRenameChapter(seriesSlug, partSlug, chapter.slug, customTitle)
            }
            inputClassName="w-40"
          />
        </p>
        <p className="text-sm text-slate-500">
          {chapter.slug} · {chapter.pageCount} 页
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onMoveChapter(seriesSlug, partSlug, chapter.slug, "up")}
          title="上移"
          className="h-8 w-8 rounded-l-full rounded-r-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          ↿
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => onMoveChapter(seriesSlug, partSlug, chapter.slug, "down")}
          title="下移"
          className="h-8 w-8 rounded-l-md rounded-r-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          ⇂
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => onDeleteChapter(seriesSlug, partSlug, chapter.slug)}
          className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          删除
        </button>
      </div>
    </div>
  );
}

function AdminComicsPage() {
  const navigate = useNavigate();
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [tree, setTree] = useState<AdminComicSeries[]>([]);
  const [selectedSeriesSlug, setSelectedSeriesSlug] = useState("");
  const [selectedPartSlug, setSelectedPartSlug] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [seriesMode, setSeriesMode] = useState<SelectMode>("existing");
  const [partMode, setPartMode] = useState<SelectMode>("existing");

  const [newSeriesSlug, setNewSeriesSlug] = useState("");
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [newPartSlug, setNewPartSlug] = useState("");
  const [newPartTitle, setNewPartTitle] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ownerCandidates, setOwnerCandidates] = useState<AdminComicOwner[]>([]);

  async function loadTree(preferred?: {
    seriesSlug?: string;
    partSlug?: string;
  }) {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchAdminComicsTree();
      setTree(data);

      const nextSeries =
        data.find((series) => series.slug === preferred?.seriesSlug) ??
        data.find((series) => series.slug === selectedSeriesSlug) ??
        data[0] ??
        null;

      setSelectedSeriesSlug(nextSeries?.slug ?? "");

      const nextPart =
        nextSeries?.parts.find((part) => part.slug === preferred?.partSlug) ??
        nextSeries?.parts.find((part) => part.slug === selectedPartSlug) ??
        nextSeries?.parts[0] ??
        null;

      setSelectedPartSlug(nextPart?.slug ?? "");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "加载失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function checkLogin() {
      try {
        const user = await getMe();

        if (user.role !== "admin") {
          navigate("/admin/login");
        }
        setIsAuthReady(true);
      } catch {
        clearAccessToken();
        navigate("/admin/login");
      }
    }

    checkLogin();
  }, [navigate]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    loadTree();
    loadOwnerCandidates();
  }, [isAuthReady]);

  async function loadOwnerCandidates() {
    try {
      const data = await fetchAdminComicOwnerCandidates();
      setOwnerCandidates(data);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "加载 owner 候选人失败。"
      );
    }
  }

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setErrorMessage("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [errorMessage]);

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
    setErrorMessage("");
    setSuccessMessage("");

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
    setErrorMessage("");
    setSuccessMessage("");

    if (value === NEW_OPTION) {
      setPartMode("new");
      setSelectedPartSlug("");
      return;
    }

    setPartMode("existing");
    setSelectedPartSlug(value);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    setFiles(selectedFiles);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const finalSeriesSlug =
      seriesMode === "new" ? newSeriesSlug.trim() : selectedSeriesSlug;

    const finalPartSlug =
      partMode === "new" ? newPartSlug.trim() : selectedPartSlug;

    if (!finalSeriesSlug) {
      setErrorMessage("请选择或填写 series slug。");
      return;
    }

    if (!finalPartSlug) {
      setErrorMessage("请选择或填写 part slug。");
      return;
    }

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

    if (partMode === "existing" && !selectedPart) {
      setErrorMessage("当前选择的 part 不存在。");
      return;
    }

    if (files.length === 0) {
      setErrorMessage("请选择要上传的图片。");
      return;
    }

    setSubmitting(true);

    try {
      await uploadAdminComicChapter({
        seriesSlug: finalSeriesSlug,
        partSlug: finalPartSlug,
        chapterTitle,
        seriesTitle: seriesMode === "new" ? newSeriesTitle : undefined,
        partTitle: partMode === "new" ? newPartTitle : undefined,
        files,
      });

      setSeriesMode("existing");
      setSelectedSeriesSlug(finalSeriesSlug);
      setPartMode("existing");
      setSelectedPartSlug(finalPartSlug);

      setNewSeriesSlug("");
      setNewSeriesTitle("");
      setNewPartSlug("");
      setNewPartTitle("");
      setChapterTitle("");
      setFiles([]);
      setSuccessMessage(`已上传新章节：${finalSeriesSlug}/${finalPartSlug}`);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadTree({
        seriesSlug: finalSeriesSlug,
        partSlug: finalPartSlug,
      });
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
    setSuccessMessage("");

    try {
      await deleteAdminComicChapter({
        seriesSlug,
        partSlug,
        chapterSlug,
      });

      setSuccessMessage(`已删除 chapter：${seriesSlug}/${partSlug}/${chapterSlug}`);
      await loadTree({ seriesSlug, partSlug });
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

    if (input === null) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (input !== partSlug) {
      setErrorMessage("输入 slug 错误，请检查后重新输入。");
      return;
    }

    setSubmitting(true);

    try {
      await deleteAdminComicPart({
        seriesSlug,
        partSlug,
      });

      setSuccessMessage(`已删除 part：${seriesSlug}/${partSlug}`);
      await loadTree({ seriesSlug });
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

    if (input === null) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (input !== seriesSlug) {
      setErrorMessage("输入 slug 错误，请检查后重新输入。");
      return;
    }

    setSubmitting(true);

    try {
      await deleteAdminComicSeries({ seriesSlug });

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

  async function handleRenameSeries(seriesSlug: string, title: string) {
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await renameAdminComicSeries({ seriesSlug, title });
      setSuccessMessage(`已重命名 series：${seriesSlug}`);
      await loadTree({ seriesSlug });
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "重命名 series 失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRenamePart(
    seriesSlug: string,
    partSlug: string,
    title: string
  ) {
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await renameAdminComicPart({ seriesSlug, partSlug, title });
      setSuccessMessage(`已重命名 part：${seriesSlug}/${partSlug}`);
      await loadTree({ seriesSlug, partSlug });
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "重命名 part 失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRenameChapter(
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    customTitle: string
  ) {
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await renameAdminComicChapter({
        seriesSlug,
        partSlug,
        chapterSlug,
        customTitle,
      });

      setSuccessMessage(`已重命名 chapter：${seriesSlug}/${partSlug}/${chapterSlug}`);
      await loadTree({ seriesSlug, partSlug });
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "重命名 chapter 失败。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMoveChapter(
    seriesSlug: string,
    partSlug: string,
    chapterSlug: string,
    direction: MoveDirection
  ) {
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await moveAdminComicChapter({
        seriesSlug,
        partSlug,
        chapterSlug,
        direction,
      });

      if (!result.moved) {
        setErrorMessage(result.reason ?? "章节顺序未发生变化。");
        return;
      }

      setSuccessMessage(
        direction === "up"
          ? `已上移章节：${chapterSlug}`
          : `已下移章节：${chapterSlug}`
      );

      await loadTree({ seriesSlug, partSlug });
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "移动章节失败。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetPartOwner(
    seriesSlug: string,
    partSlug: string,
    username: string | null
  ) {
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await setAdminComicPartOwner({
        seriesSlug,
        partSlug,
        username,
      });

      setSuccessMessage(`已更新 owner：${seriesSlug}/${partSlug}`);
      await loadTree({ seriesSlug, partSlug });
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "更新 owner 失败。");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl p-6">正在加载后台数据...</main>;
  }

  if (!isAuthReady) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <section className="mx-auto max-w-5xl">
          <p className="text-sm text-slate-400">正在检查登录状态...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <section>
        <h1 className="text-2xl font-bold">漫画后台管理</h1>
        <p className="mt-2 text-slate-600">
          当前页面用于本地上传章节、调整章节顺序和删除测试内容。
        </p>
      </section>

      <MessageArea
        errorMessage={errorMessage}
        successMessage={successMessage}
      />

      <UploadChapterForm
        tree={tree}
        selectedSeries={selectedSeries}
        selectedPart={selectedPart}
        selectedSeriesSlug={selectedSeriesSlug}
        selectedPartSlug={selectedPartSlug}
        seriesMode={seriesMode}
        partMode={partMode}
        newSeriesSlug={newSeriesSlug}
        newSeriesTitle={newSeriesTitle}
        newPartSlug={newPartSlug}
        newPartTitle={newPartTitle}
        chapterTitle={chapterTitle}
        files={files}
        submitting={submitting}
        newSeriesSlugExists={newSeriesSlugExists}
        newPartSlugExists={newPartSlugExists}
        fileInputRef={fileInputRef}
        onSeriesChange={handleSeriesChange}
        onPartChange={handlePartChange}
        onNewSeriesSlugChange={setNewSeriesSlug}
        onNewSeriesTitleChange={setNewSeriesTitle}
        onNewPartSlugChange={setNewPartSlug}
        onNewPartTitleChange={setNewPartTitle}
        onChapterTitleChange={setChapterTitle}
        onFileChange={handleFileChange}
        onSubmit={handleUpload}
      />

      <ComicTreeView
        tree={tree}
        submitting={submitting}
        onRenameSeries={handleRenameSeries}
        onRenamePart={handleRenamePart}
        onRenameChapter={handleRenameChapter}
        onDeleteSeries={handleDeleteSeries}
        onDeletePart={handleDeletePart}
        onMoveChapter={handleMoveChapter}
        onDeleteChapter={handleDeleteChapter}
        ownerCandidates={ownerCandidates}
        onSetPartOwner={handleSetPartOwner}
      />
    </main>
  );
}

export default AdminComicsPage;
