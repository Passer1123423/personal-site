import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../api/notifications";

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

  return "通知";
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

function NotificationBubble({
  item,
  onOpen,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
}) {
  const actorName = item.actorDisplayName || item.actorUsername || "有人";
  const imageCount = getNotificationImageCount(item);

  return (
    <button
      type="button"
      className={`group flex w-full gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        item.isRead
          ? "border-[var(--color-border-soft)] bg-white/80"
          : "border-[var(--color-accent-border)] bg-[var(--color-accent-soft)]"
      }`}
      onClick={() => onOpen(item)}
    >
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent-border)] bg-white text-sm font-semibold text-[var(--color-accent)]">
        {actorName.slice(0, 1).toUpperCase()}
      </div>

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

        <div className="mt-2 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-main group-hover:text-[var(--color-accent)]">
              {item.title}
            </p>

            {item.body && (
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                {item.body}
              </p>
            )}
          </div>

          <span
            className={`mt-1 shrink-0 text-lg leading-none transition group-hover:translate-x-1 group-hover:text-[var(--color-accent)] ${
              item.targetUrl ? "text-soft" : "text-[var(--color-border-control)]"
            }`}
            aria-hidden="true"
          >
            →
          </span>
        </div>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items],
  );

  async function loadNotifications(nextUnreadOnly = unreadOnly) {
    setLoading(true);
    setError("");

    try {
      const result = await fetchNotifications({
        limit: 12,
        offset: 0,
        unreadOnly: nextUnreadOnly,
      });

      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      setError(error instanceof Error ? error.message : "获取通知失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggleUnreadOnly() {
    const nextValue = !unreadOnly;
    setUnreadOnly(nextValue);
    await loadNotifications(nextValue);
  }

  async function handleReadAll() {
    setWorking(true);
    setError("");

    try {
      await markAllNotificationsRead();
      await loadNotifications(unreadOnly);
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

      await loadNotifications(unreadOnly);
    } catch (error) {
      setError(error instanceof Error ? error.message : "打开通知失败");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="page-shell py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="overflow-hidden rounded-[var(--radius-card-large)] border border-[var(--color-border-soft)] bg-white shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">
                  Messages
                </p>
                <h1 className="mt-1 text-2xl font-bold text-main">消息通知</h1>
                <p className="mt-1 text-sm text-muted">
                  共 {total} 条通知，当前列表中 {unreadCount} 条未读
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-sm ${
                    unreadOnly
                      ? "border-[var(--color-accent-border-strong)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "border-[var(--color-border-soft)] bg-white text-main hover:border-[var(--color-accent-border)] hover:text-[var(--color-accent)]"
                  }`}
                  onClick={handleToggleUnreadOnly}
                  disabled={working || loading}
                >
                  只看未读
                </button>

                <button
                  type="button"
                  className="rounded-full border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm font-semibold text-main transition hover:-translate-y-0.5 hover:border-[var(--color-accent-border)] hover:text-[var(--color-accent)] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleReadAll}
                  disabled={working || loading || unreadCount === 0}
                >
                  全部已读
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
            ) : items.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="rounded-3xl border border-dashed border-[var(--color-border-soft)] bg-white/80 px-8 py-10 text-center">
                  <p className="text-base font-semibold text-main">
                    暂时没有通知
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    收到评论回复或主页留言后，会显示在这里。
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <NotificationBubble
                    key={item.id}
                    item={item}
                    onOpen={handleOpenNotification}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
