import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import SearchBox from "../components/SearchBox";
import SearchablePicker, {
  type SearchablePickerOption,
} from "../components/SearchablePicker";

import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationAssetUrl,
  type NotificationItem,
} from "../api/notifications";

const PAGE_SIZE = 5;

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNotificationKindLabel(type: string) {
  if (type === "comment.reply") {
    return "评论回复";
  }

  if (type === "comment.user_page") {
    return "主页留言";
  }

  if (type === "comment.novel") {
    return "小说评论";
  }

  if (type === "comment.novel_chapter") {
    return "小说评论";
  }

  if (type === "comment.comic_part") {
    return "漫画评论";
  }

  if (type === "comment.comic_chapter") {
    return "漫画评论";
  }

  if (type === "favorite.created") {
    return "作品收藏";
  }

  if (type === "subscription.chapter_published") {
    return "收藏更新";
  }

  if (type === "subscription.chapter_updated") {
    return "章节更新";
  }

  return "未分类通知";
}

function getNotificationImageCount(item: NotificationItem) {
  const value = item.metadata?.image_count;

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function notificationMatchesKeyword(item: NotificationItem, keyword: string) {
  const cleanKeyword = normalizeSearchText(keyword);

  if (!cleanKeyword) {
    return true;
  }

  const searchableText = [
    item.title,
    item.body,
    item.actorUsername,
    item.actorDisplayName,
    getNotificationKindLabel(item.type),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(cleanKeyword);
}

function countByType(items: NotificationItem[], type: string) {
  if (!type) {
    return items.length;
  }

  return items.filter((item) => item.type === type).length;
}

function countByReadState(items: NotificationItem[], state: string) {
  if (!state) {
    return items.length;
  }

  if (state === "unread") {
    return items.filter((item) => !item.isRead).length;
  }

  if (state === "read") {
    return items.filter((item) => item.isRead).length;
  }

  return items.length;
}

function NotificationBubble({
  item,
  onOpen,
  onDelete,
  isDeleteConfirming,
  isDeleting,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  onDelete: (item: NotificationItem) => void;
  isDeleteConfirming: boolean;
  isDeleting: boolean;
}) {
  const actorName = item.actorDisplayName || item.actorUsername || "有人";
  const actorAvatarUrl = resolveNotificationAssetUrl(item.actorAvatarUrl);
  const imageCount = getNotificationImageCount(item);

  return (
    <div
      className={`group flex w-full gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        item.isRead
          ? "border-[var(--color-border-soft)] bg-white/80"
          : "border-[var(--color-accent-border)] bg-[var(--color-accent-soft)]"
      }`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 gap-3 text-left"
        onClick={() => onOpen(item)}
        disabled={isDeleting}
      >
        {actorAvatarUrl ? (
          <div className="mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--color-accent-border)] bg-white">
            <img
              src={actorAvatarUrl}
              alt={actorName}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent-border)] bg-white text-sm font-semibold text-[var(--color-accent)]">
            {actorName.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-accent)]">
              {getNotificationKindLabel(item.type)}
            </span>

            {!item.isRead && (
              <span className="h-2 w-2 rounded-full bg-[var(--color-danger)]" />
            )}

            {imageCount > 0 && (
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-soft">
                图片 {imageCount} 张
              </span>
            )}

            <span className="ml-auto text-xs text-soft">
              {formatNotificationTime(item.createdAt)}
            </span>
          </div>

          <div className="mt-2 min-w-0">
            <p className="text-sm font-semibold text-main group-hover:text-[var(--color-accent)]">
              {item.title}
            </p>

            {item.body && (
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                {item.body}
              </p>
            )}
          </div>
        </div>
      </button>

      <div className="flex w-10 shrink-0 flex-col items-center pt-8">
        <span
          className={`shrink-0 text-lg leading-none transition group-hover:translate-x-1 group-hover:text-[var(--color-accent)] ${
            item.targetUrl ? "text-soft" : "text-[var(--color-border-control)]"
          }`}
          aria-hidden="true"
        >
          →
        </span>

        <button
          type="button"
          className={`mt-2 text-xs leading-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isDeleteConfirming
              ? "font-semibold text-[var(--color-danger)]"
              : "text-[var(--color-danger)] opacity-60 hover:font-semibold hover:opacity-100"
          }`}
          onClick={() => onDelete(item)}
          disabled={isDeleting}
          title={isDeleteConfirming ? "再次点击确认删除" : "删除通知"}
        >
          {isDeleteConfirming ? "确认" : "删除"}
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [readStateFilter, setReadStateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const typeOptions = useMemo<SearchablePickerOption[]>(
    () => [
      {
        value: "",
        label: "全部类型",
        badge: String(items.length),
        searchText: "全部 all",
      },
      {
        value: "comment.reply",
        label: "评论回复",
        badge: String(countByType(items, "comment.reply")),
        searchText: "评论 回复 comment reply",
      },
      {
        value: "comment.user_page",
        label: "主页留言",
        badge: String(countByType(items, "comment.user_page")),
        searchText: "主页 留言 user page",
      },
      {
        value: "comment.novel",
        label: "小说评论",
        badge: String(countByType(items, "comment.novel")),
        searchText: "小说 评论 novel comment",
      },
      {
        value: "comment.novel_chapter",
        label: "小说章节评论",
        badge: String(countByType(items, "comment.novel_chapter")),
        searchText: "小说 章节 评论 novel chapter comment",
      },
      {
        value: "comment.comic_part",
        label: "漫画章节评论",
        badge: String(countByType(items, "comment.comic_part")),
        searchText: "漫画 章节 评论 comic part comment",
      },
      {
        value: "comment.comic_chapter",
        label: "漫画某话评论",
        badge: String(countByType(items, "comment.comic_chapter")),
        searchText: "漫画 话 评论 comic chapter comment",
      },
      {
        value: "favorite.created",
        label: "作品收藏",
        badge: String(countByType(items, "favorite.created")),
        searchText: "作品 收藏 favorite created novel comic",
      },
      {
        value: "subscription.chapter_published",
        label: "收藏更新",
        badge: String(countByType(items, "subscription.chapter_published")),
        searchText: "收藏 更新 新章节 发布 subscription chapter published novel comic",
      },
      {
        value: "subscription.chapter_updated",
        label: "内容更新",
        badge: String(countByType(items, "subscription.chapter_updated")),
        searchText: "收藏 章节 内容更新 subscription chapter updated novel comic",
      },
    ],
    [items],
  );

  const readStateOptions = useMemo<SearchablePickerOption[]>(
    () => [
      {
        value: "",
        label: "全部状态",
        badge: String(items.length),
        searchText: "全部 all",
      },
      {
        value: "unread",
        label: "未读",
        badge: String(countByReadState(items, "unread")),
        searchText: "未读 unread",
      },
      {
        value: "read",
        label: "已读",
        badge: String(countByReadState(items, "read")),
        searchText: "已读 read",
      },
    ],
    [items],
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter && item.type !== typeFilter) {
        return false;
      }

      if (readStateFilter === "unread" && item.isRead) {
        return false;
      }

      if (readStateFilter === "read" && !item.isRead) {
        return false;
      }

      return notificationMatchesKeyword(item, keyword);
    });
  }, [items, keyword, typeFilter, readStateFilter]);

  const hasActiveFilters = Boolean(
    keyword.trim() || typeFilter || readStateFilter,
  );

  async function loadNotifications(nextPage = page) {
    setLoading(true);
    setError("");

    try {
      const safePage = Math.max(1, nextPage);

      const result = await fetchNotifications({
        limit: PAGE_SIZE,
        offset: (safePage - 1) * PAGE_SIZE,
        unreadOnly: false,
      });

      setItems(result.items);
      setTotal(result.total);
      setPage(safePage);
    } catch (error) {
      setError(error instanceof Error ? error.message : "获取通知失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReadAll() {
    setWorking(true);
    setError("");

    try {
      await markAllNotificationsRead();
      await loadNotifications(page);
    } catch (error) {
      setError(error instanceof Error ? error.message : "全部标记已读失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleOpenNotification(item: NotificationItem) {
    setWorking(true);
    setError("");

    try {
      if (!item.isRead) {
        await markNotificationRead(item.id);
      }

      if (item.targetUrl) {
        navigate(item.targetUrl);
        return;
      }

      await loadNotifications(page);
    } catch (error) {
      setError(error instanceof Error ? error.message : "打开通知失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteNotification(item: NotificationItem) {
    if (deletingId) {
      return;
    }

    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }

    setDeletingId(item.id);
    setError("");

    try {
      await deleteNotification(item.id);

      setItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== item.id),
      );
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      setConfirmDeleteId(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "删除通知失败");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGoPrevPage() {
    if (!canGoPrev || loading || working) {
      return;
    }

    await loadNotifications(page - 1);
  }

  async function handleGoNextPage() {
    if (!canGoNext || loading || working) {
      return;
    }

    await loadNotifications(page + 1);
  }

  function handleClearFilters() {
    setKeyword("");
    setTypeFilter("");
    setReadStateFilter("");
  }

  return (
    <section className="page-shell py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="overflow-hidden rounded-[var(--radius-card-large)] border border-[var(--color-border-soft)] bg-white shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] px-5 py-4 sm:px-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] link-accent">
                    Messages
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-main">消息通知</h1>
                </div>

                <button
                  type="button"
                  className="rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm font-semibold text-main transition hover:-translate-y-0.5 hover:border-[var(--color-accent-border)] hover:text-[var(--color-accent)] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleReadAll}
                  disabled={working || loading || unreadCount === 0}
                >
                  全部已读
                </button>
              </div>

              <div className="grid gap-2 rounded-2xl border border-[var(--color-border-soft)] bg-white/85 p-2 shadow-sm lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                <SearchBox
                  value={keyword}
                  onChange={setKeyword}
                  placeholder="搜索标题、正文或发送者"
                  className="rounded-xl py-2"
                  disabled={loading}
                />

                <SearchablePicker
                  value={typeFilter}
                  options={typeOptions}
                  placeholder="类型"
                  searchPlaceholder="搜索通知类型"
                  disabled={loading}
                  onChange={setTypeFilter}
                />

                <SearchablePicker
                  value={readStateFilter}
                  options={readStateOptions}
                  placeholder="状态"
                  searchPlaceholder="搜索状态"
                  disabled={loading}
                  onChange={setReadStateFilter}
                />

                <button
                  type="button"
                  className="rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm font-semibold text-main transition hover:-translate-y-0.5 hover:border-[var(--color-accent-border)] hover:text-[var(--color-accent)] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleClearFilters}
                  disabled={loading || !hasActiveFilters}
                >
                  清除
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-[420px] bg-[var(--color-page-bg-soft)] px-4 py-5 sm:px-6">
            {error && (
              <div className="mb-4 rounded-2xl border border-[var(--color-danger)] bg-white px-4 py-3 text-sm text-[var(--color-danger)]">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center text-sm text-soft">
                正在加载通知...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="rounded-3xl border border-dashed border-[var(--color-border-soft)] bg-white/80 px-8 py-10 text-center">
                  <p className="text-base font-semibold text-main">
                    {hasActiveFilters ? "没有匹配的通知" : "暂时没有通知"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {hasActiveFilters
                      ? "可以调整搜索词、类型或状态筛选。"
                      : "收到评论回复或主页留言后，会显示在这里。"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <NotificationBubble
                    key={item.id}
                    item={item}
                    onOpen={handleOpenNotification}
                    onDelete={handleDeleteNotification}
                    isDeleteConfirming={confirmDeleteId === item.id}
                    isDeleting={deletingId === item.id}
                  />
                ))}

                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-soft)] bg-white/80 px-4 py-3 text-sm text-muted">
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-1.5 font-semibold text-main transition hover:border-[var(--color-accent-border)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleGoPrevPage}
                    disabled={!canGoPrev || loading || working}
                  >
                    上一页
                  </button>

                  <span>
                    第 {page} / {totalPages} 页，每页 {PAGE_SIZE} 条
                  </span>

                  <button
                    type="button"
                    className="rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-1.5 font-semibold text-main transition hover:border-[var(--color-accent-border)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleGoNextPage}
                    disabled={!canGoNext || loading || working}
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
