import { getAccessToken } from "./auth";
import { API_BASE_URL } from "./config";

export type ActivityLogStatus = "success" | "failed" | string;

export type AdminActivityLogItem = {
  id: string;

  actorUserId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorRole: string | null;

  action: string;
  category: string;

  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;

  status: ActivityLogStatus;
  message: string | null;
  errorCode: string | null;

  metadata: unknown;

  ipAddress: string | null;
  userAgent: string | null;

  createdAt: string;
};

export type AdminActivityLogListResponse = {
  items: AdminActivityLogItem[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminActivityLogListParams = {
  keyword?: string;
  category?: string;
  action?: string;
  actorUserId?: string;
  actorUsername?: string;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
  offset?: number;
};

function requireAdminToken(): string {
  const token = getAccessToken();

  if (!token) {
    throw new Error("未登录");
  }

  return token;
}

function appendParam(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  params.set(key, String(value));
}

export async function adminListActivityLogs(
  params: AdminActivityLogListParams = {},
): Promise<AdminActivityLogListResponse> {
  const token = requireAdminToken();
  const searchParams = new URLSearchParams();

  appendParam(searchParams, "keyword", params.keyword);
  appendParam(searchParams, "category", params.category);
  appendParam(searchParams, "action", params.action);
  appendParam(searchParams, "actor_user_id", params.actorUserId);
  appendParam(searchParams, "actor_username", params.actorUsername);
  appendParam(searchParams, "actor_role", params.actorRole);
  appendParam(searchParams, "target_type", params.targetType);
  appendParam(searchParams, "target_id", params.targetId);
  appendParam(searchParams, "status", params.status);
  appendParam(searchParams, "created_from", params.createdFrom);
  appendParam(searchParams, "created_to", params.createdTo);
  appendParam(searchParams, "limit", params.limit);
  appendParam(searchParams, "offset", params.offset);

  const queryString = searchParams.toString();
  const url = queryString
    ? `${API_BASE_URL}/api/admin/activity-logs?${queryString}`
    : `${API_BASE_URL}/api/admin/activity-logs`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "加载操作日志失败");
  }

  return response.json();
}

export async function adminGetActivityLog(
  logId: string,
): Promise<AdminActivityLogItem> {
  const token = requireAdminToken();

  const response = await fetch(`${API_BASE_URL}/api/admin/activity-logs/${logId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "加载操作日志详情失败");
  }

  return response.json();
}