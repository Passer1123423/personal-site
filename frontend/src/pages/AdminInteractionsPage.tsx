import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearAccessToken, getMe } from "../api/auth";
import {
  adminGetCommentTreeByCommentId,
  adminHardDeleteComment,
  adminListComments,
  adminSoftDeleteComment,
  type AdminCommentItem,
  type AdminCommentTreeItem,
} from "../api/adminInteractions";

import SearchablePicker, {
  type SearchablePickerOption,
} from "../components/SearchablePicker";
import { fetchAdminUsers, type AdminUser } from "../api/adminUsers";
import { fetchAdminNovelsTree, type AdminNovel } from "../api/adminNovels";
import { fetchAdminComicsTree, type AdminComicSeries } from "../api/adminComics";
import { formatChinaDateTimeToMinute } from "../utils/time";

type SortMode = "newest" | "oldest" | "reply_count_desc";

const TARGET_TYPE_OPTIONS = [
  { value: "", label: "全部类型" },
  { value: "user_page", label: "个人页" },
  { value: "novel", label: "小说" },
  { value: "novel_chapter", label: "小说章节" },
  { value: "comic_part", label: "漫画 Part" },
  { value: "comic_chapter", label: "漫画章节" },
];

type TargetOptionsByType = {
  user_page: SearchablePickerOption[];
  novel: SearchablePickerOption[];
  novel_chapter: SearchablePickerOption[];
  comic_part: SearchablePickerOption[];
  comic_chapter: SearchablePickerOption[];
};

function buildUserOptions(users: AdminUser[]): SearchablePickerOption[] {
  return users.map((user) => ({
    value: user.id,
    label: user.displayName || user.username,
    description: `@${user.username}`,
    badge: user.role,
    searchText: `${user.id} ${user.username} ${user.displayName} ${user.role}`,
  }));
}

function buildNovelOptions(novels: AdminNovel[]): SearchablePickerOption[] {
  return novels.map((novel) => ({
    value: novel.id,
    label: novel.title,
    description: novel.slug,
    badge: "小说",
    searchText: `${novel.id} ${novel.title} ${novel.slug}`,
  }));
}

function buildNovelChapterOptions(novels: AdminNovel[]): SearchablePickerOption[] {
  return novels.flatMap((novel) =>
    novel.chapters.map((chapter) => ({
      value: chapter.id,
      label: chapter.title,
      description: `${novel.title} / ${novel.slug}/${chapter.slug}`,
      badge: "章节",
      searchText: `${chapter.id} ${chapter.title} ${chapter.slug} ${novel.title} ${novel.slug}`,
    })),
  );
}

function buildComicPartOptions(seriesList: AdminComicSeries[]): SearchablePickerOption[] {
  return seriesList.flatMap((series) =>
    series.parts.map((part) => ({
      value: part.id,
      label: part.title,
      description: `${series.title} / ${series.slug}/${part.slug}`,
      badge: "Part",
      searchText: `${part.id} ${part.title} ${part.slug} ${series.title} ${series.slug}`,
    })),
  );
}

function buildComicChapterOptions(seriesList: AdminComicSeries[]): SearchablePickerOption[] {
  return seriesList.flatMap((series) =>
    series.parts.flatMap((part) =>
      part.chapters.map((chapter) => ({
        value: chapter.id,
        label: chapter.title,
        description: `${series.title} / ${part.title} / ${series.slug}/${part.slug}/${chapter.slug}`,
        badge: "章节",
        searchText: `${chapter.id} ${chapter.title} ${chapter.slug} ${part.title} ${part.slug} ${series.title} ${series.slug}`,
      })),
    ),
  );
}

function getUserLabel(comment: AdminCommentItem) {
  if (!comment.user) {
    return "未知用户";
  }

  return comment.user.display_name || comment.user.username;
}

function getContentPreview(comment: AdminCommentItem) {
  if (comment.is_deleted) {
    return comment.content || "该评论已删除";
  }

  return comment.content || "空评论";
}

function CommentContextNode({
  node,
  activeId,
  depth = 0,
}: {
  node: AdminCommentTreeItem;
  activeId: string;
  depth?: number;
}) {
  return (
    <div
      className={[
        "rounded-xl border px-3 py-2",
        node.id === activeId
          ? "border-[var(--color-accent-border-strong)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-border-soft)] bg-[var(--color-panel-bg)]",
      ].join(" ")}
      style={{ marginLeft: depth * 18 }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-main">
          {getUserLabel(node)}
        </span>
        <span className="text-[11px] text-soft">
          {formatChinaDateTimeToMinute(node.created_at)}
        </span>
      </div>

      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
        {node.is_deleted ? "已删除：" : ""}
        {node.content || "该评论已删除"}
      </p>

      {node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <CommentContextNode
              key={child.id}
              node={child}
              activeId={activeId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminInteractionsPage() {
  const navigate = useNavigate();

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [items, setItems] = useState<AdminCommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedComment, setSelectedComment] = useState<AdminCommentItem | null>(null);
  const [contextTree, setContextTree] = useState<AdminCommentTreeItem[]>([]);

  const [keyword, setKeyword] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [userId, setUserId] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [onlyDeleted, setOnlyDeleted] = useState(false);
  const [hasReplies, setHasReplies] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [offset, setOffset] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [userOptions, setUserOptions] = useState<SearchablePickerOption[]>([]);
  const [targetOptionsByType, setTargetOptionsByType] =
    useState<TargetOptionsByType>({
      user_page: [],
      novel: [],
      novel_chapter: [],
      comic_part: [],
      comic_chapter: [],
    });

  const limit = 30;

  const maxPage = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [total]);

  const currentPage = useMemo(() => {
    return Math.floor(offset / limit) + 1;
  }, [offset]);

  useEffect(() => {
    async function checkLogin() {
      try {
        const user = await getMe();

        if (user.role !== "admin") {
          navigate("/admin/login", { replace: true });
          return;
        }

        setIsAuthReady(true);
      } catch {
        clearAccessToken();
        navigate("/admin/login", { replace: true });
      }
    }

    checkLogin();
  }, [navigate]);

  const currentTargetOptions = useMemo(() => {
    if (targetType === "user_page") {
      return userOptions;
    }

    if (
      targetType === "novel" ||
      targetType === "novel_chapter" ||
      targetType === "comic_part" ||
      targetType === "comic_chapter"
    ) {
      return targetOptionsByType[targetType];
    }

    return [];
  }, [targetType, targetOptionsByType, userOptions]);

  async function loadComments(nextOffset = offset) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await adminListComments({
        keyword: keyword.trim() || undefined,
        targetType: targetType || undefined,
        targetId: targetId.trim() || undefined,
        userId: userId.trim() || undefined,
        includeDeleted,
        onlyDeleted,
        hasReplies:
          hasReplies === "true" ? true : hasReplies === "false" ? false : null,
        sort,
        limit,
        offset: nextOffset,
      });

      setItems(data.items);
      setTotal(data.total);
      setOffset(data.offset);

      if (selectedComment) {
        const nextSelected = data.items.find((item) => item.id === selectedComment.id);
        if (nextSelected) {
          setSelectedComment(nextSelected);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载评论失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadContext(comment: AdminCommentItem) {
    setSelectedComment(comment);
    setIsContextLoading(true);
    setErrorMessage("");

    try {
      const tree = await adminGetCommentTreeByCommentId(comment.id);
      setContextTree(tree);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载上下文失败");
    } finally {
      setIsContextLoading(false);
    }
  }

  async function loadPickerOptions() {
    setIsPickerLoading(true);

    try {
      const [users, novels, comics] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminNovelsTree(),
        fetchAdminComicsTree(),
      ]);

      const nextUserOptions = buildUserOptions(users);

      setUserOptions(nextUserOptions);
      setTargetOptionsByType({
        user_page: nextUserOptions,
        novel: buildNovelOptions(novels),
        novel_chapter: buildNovelChapterOptions(novels),
        comic_part: buildComicPartOptions(comics),
        comic_chapter: buildComicChapterOptions(comics),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载筛选候选项失败");
    } finally {
      setIsPickerLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthReady) {
      loadComments(0);
      loadPickerOptions();
    }
  }, [isAuthReady]);

  function handleSearch() {
    loadComments(0);
  }

  function handleReset() {
    setKeyword("");
    setTargetType("");
    setTargetId("");
    setUserId("");
    setIncludeDeleted(true);
    setOnlyDeleted(false);
    setHasReplies("");
    setSort("newest");
    setOffset(0);

    window.setTimeout(() => {
      loadComments(0);
    }, 0);
  }

  async function handleSoftDelete(comment: AdminCommentItem) {
    const confirmed = window.confirm("确定软删除这条评论吗？数据库会保留原文。");

    if (!confirmed) {
      return;
    }

    try {
      await adminSoftDeleteComment(comment.id);
      await loadComments(offset);
      if (selectedComment?.id === comment.id) {
        await loadContext(comment);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "软删除失败");
    }
  }

  async function handleHardDelete(comment: AdminCommentItem) {
    const confirmed = window.confirm(
      "确定硬删除这条评论吗？该操作不可恢复。若存在子评论，后端会拒绝删除。",
    );

    if (!confirmed) {
      return;
    }

    try {
      await adminHardDeleteComment(comment.id);
      setSelectedComment(null);
      setContextTree([]);
      await loadComments(offset);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "硬删除失败");
    }
  }

  if (!isAuthReady) {
    return (
      <main className="admin-page-shell px-6 py-10">
        <section className="mx-auto max-w-7xl">
          <p className="text-sm text-soft">正在检查登录状态...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page-shell px-6 py-10">
      <section className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Link to="/admin" className="link-accent text-sm">
              返回后台首页
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-main">互动管理</h1>
            <p className="mt-2 text-sm text-muted">
              按评论内容、目标对象、用户和状态检索站内评论。
            </p>
          </div>

          <button
            type="button"
            className="rounded-xl border border-[var(--color-border-control)] px-4 py-2 text-sm text-muted hover:bg-[var(--color-panel-soft-bg)] hover:text-main"
            onClick={() => loadComments(offset)}
          >
            刷新
          </button>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-[var(--color-danger)]/30 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 grid grid-cols-[320px_minmax(0,1fr)_360px] gap-5">
          <aside className="surface-card h-fit p-5">
            <h2 className="text-lg font-semibold text-main">筛选</h2>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs text-soft">关键词</span>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border-control)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-border-strong)]"
                  placeholder="搜索评论正文"
                />
              </label>

              <label className="block">
                <span className="text-xs text-soft">目标类型</span>
                <select
                  value={targetType}
                  onChange={(event) => {
                    setTargetType(event.target.value);
                    setTargetId("");
                  }}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border-control)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-border-strong)]"
                >
                  {TARGET_TYPE_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-soft">目标对象</span>
                <div className="mt-1">
                  <SearchablePicker
                    value={targetId}
                    options={currentTargetOptions}
                    isLoading={isPickerLoading}
                    disabled={!targetType}
                    placeholder={targetType ? "选择目标对象" : "先选择目标类型"}
                    searchPlaceholder="搜索标题、slug 或 ID"
                    emptyText="没有匹配的目标对象"
                    onChange={setTargetId}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs text-soft">用户</span>
                <div className="mt-1">
                  <SearchablePicker
                    value={userId}
                    options={userOptions}
                    isLoading={isPickerLoading}
                    placeholder="选择用户"
                    searchPlaceholder="搜索用户名、显示名或 ID"
                    emptyText="没有匹配的用户"
                    onChange={setUserId}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs text-soft">回复状态</span>
                <select
                  value={hasReplies}
                  onChange={(event) => setHasReplies(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border-control)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-border-strong)]"
                >
                  <option value="">全部</option>
                  <option value="true">有回复</option>
                  <option value="false">无回复</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-soft">排序</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border-control)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-border-strong)]"
                >
                  <option value="newest">最新优先</option>
                  <option value="oldest">最早优先</option>
                  <option value="reply_count_desc">回复数优先</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(event) => setIncludeDeleted(event.target.checked)}
                />
                包含已删除评论
              </label>

              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={onlyDeleted}
                  onChange={(event) => setOnlyDeleted(event.target.checked)}
                />
                只看已删除
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]"
                  onClick={handleSearch}
                >
                  查询
                </button>

                <button
                  type="button"
                  className="rounded-xl border border-[var(--color-border-control)] px-4 py-2 text-sm text-muted hover:bg-[var(--color-panel-soft-bg)]"
                  onClick={handleReset}
                >
                  重置
                </button>
              </div>
            </div>
          </aside>

          <section className="surface-card min-w-0 p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-main">评论列表</h2>
              <span className="text-sm text-soft">
                共 {total} 条 · 第 {currentPage} / {maxPage} 页
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                <p className="py-8 text-sm text-soft">正在加载评论...</p>
              ) : items.length === 0 ? (
                <p className="py-8 text-sm text-soft">没有匹配的评论。</p>
              ) : (
                items.map((comment) => (
                  <article
                    key={comment.id}
                    className={[
                      "rounded-xl border p-4 transition",
                      selectedComment?.id === comment.id
                        ? "border-[var(--color-accent-border-strong)] bg-[var(--color-accent-soft)]"
                        : "border-[var(--color-border-soft)] bg-white hover:bg-[var(--color-panel-soft-bg)]",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      className="block w-full text-left"
                      onClick={() => loadContext(comment)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-medium text-main">
                              {getUserLabel(comment)}
                            </span>
                            <span className="text-soft">{comment.user?.username}</span>
                            {comment.is_deleted && (
                              <span className="rounded bg-red-50 px-2 py-0.5 text-[var(--color-danger)]">
                                已删除
                              </span>
                            )}
                            {comment.parent_id && (
                              <span className="rounded bg-[var(--color-panel-soft-bg)] px-2 py-0.5 text-soft">
                                子评论
                              </span>
                            )}
                          </div>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                            {getContentPreview(comment)}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-soft">
                            <span>{comment.target_type}</span>
                            <span className="max-w-[260px] truncate">{comment.target_id}</span>
                            <span>
                              {formatChinaDateTimeToMinute(comment.created_at)}
                            </span>
                            <span>回复 {comment.reply_count}</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="mt-3 flex justify-end gap-2">
                      {!comment.is_deleted && (
                        <button
                          type="button"
                          className="rounded-lg border border-[var(--color-border-control)] px-3 py-1.5 text-xs text-muted hover:bg-[var(--color-panel-soft-bg)]"
                          onClick={() => handleSoftDelete(comment)}
                        >
                          软删除
                        </button>
                      )}

                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-[var(--color-danger)] hover:bg-red-50"
                        onClick={() => handleHardDelete(comment)}
                      >
                        硬删除
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                className="rounded-xl border border-[var(--color-border-control)] px-4 py-2 text-sm text-muted disabled:opacity-50"
                disabled={offset <= 0 || isLoading}
                onClick={() => loadComments(Math.max(0, offset - limit))}
              >
                上一页
              </button>

              <button
                type="button"
                className="rounded-xl border border-[var(--color-border-control)] px-4 py-2 text-sm text-muted disabled:opacity-50"
                disabled={offset + limit >= total || isLoading}
                onClick={() => loadComments(offset + limit)}
              >
                下一页
              </button>
            </div>
          </section>

          <aside className="surface-card h-fit max-h-[calc(100vh-120px)] overflow-y-auto p-5">
            <h2 className="text-lg font-semibold text-main">评论详情</h2>

            {!selectedComment ? (
              <p className="mt-4 text-sm text-soft">点击左侧评论查看上下文。</p>
            ) : (
              <div className="mt-4">
                <div className="rounded-xl border border-[var(--color-border-soft)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-main">
                      {getUserLabel(selectedComment)}
                    </span>
                    <span className="text-xs text-soft">
                      {formatChinaDateTimeToMinute(selectedComment.created_at)}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted">
                    {selectedComment.content || "该评论已删除"}
                  </p>

                  <div className="mt-4 space-y-1 text-xs text-soft">
                    <p>ID：{selectedComment.id}</p>
                    <p>target：{selectedComment.target_type}</p>
                    <p className="break-all">target_id：{selectedComment.target_id}</p>
                    <p>user_id：{selectedComment.user_id}</p>
                    <p>parent_id：{selectedComment.parent_id || "无"}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-main">上下文</h3>

                  {isContextLoading ? (
                    <p className="mt-3 text-sm text-soft">正在加载上下文...</p>
                  ) : contextTree.length === 0 ? (
                    <p className="mt-3 text-sm text-soft">暂无上下文。</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {contextTree.map((node) => (
                        <CommentContextNode
                          key={node.id}
                          node={node}
                          activeId={selectedComment.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
