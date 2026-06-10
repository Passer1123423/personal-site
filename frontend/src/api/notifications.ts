import { API_BASE_URL } from "./config";
import { getAccessToken } from "./auth";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  actorUserId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  targetType: string | null;
  targetId: string | null;
  targetUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  metadata: Record<string, unknown>;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  total: number;
  limit: number;
  offset: number;
};

export type UnreadNotificationCountResponse = {
  count: number;
};

function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();

  if (!token) {
    throw new Error("未登录");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<NotificationListResponse> {
  const query = new URLSearchParams();

  query.set("limit", String(params?.limit ?? 20));
  query.set("offset", String(params?.offset ?? 0));

  if (params?.unreadOnly) {
    query.set("unread_only", "true");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/notifications?${query.toString()}`,
    {
      headers: getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "获取通知失败");
  }

  return response.json();
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/unread-count`,
    {
      headers: getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "获取未读通知数失败");
  }

  const result: UnreadNotificationCountResponse = await response.json();
  return result.count;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationItem> {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/${notificationId}/read`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "标记通知已读失败");
  }

  window.dispatchEvent(new Event("notifications-changed"));

  return response.json();
}

export async function markAllNotificationsRead(): Promise<{
  updatedCount: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "全部标记已读失败");
  }

  window.dispatchEvent(new Event("notifications-changed"));

  return response.json();
}
