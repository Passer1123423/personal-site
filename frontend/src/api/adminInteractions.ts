import { API_BASE_URL } from "./config";
import { getAccessToken } from "./auth";

export type AdminCommentUser = {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
};

export type AdminCommentItem = {
  id: string;
  target_type: string;
  target_id: string;
  user_id: string;
  user: AdminCommentUser | null;
  content: string;
  parent_id: string | null;
  is_deleted: boolean;
  reply_count: number;
  image_count?: number;
  created_at: string;
  updated_at: string;
};

export type AdminCommentTreeItem = AdminCommentItem & {
  children: AdminCommentTreeItem[];
};

export type AdminCommentListResponse = {
  items: AdminCommentItem[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminCommentListParams = {
  keyword?: string;
  targetType?: string;
  targetId?: string;
  userId?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  hasReplies?: boolean | null;
  sort?: "newest" | "oldest" | "reply_count_desc";
  limit?: number;
  offset?: number;
};

function getRequiredToken() {
  const token = getAccessToken();

  if (!token) {
    throw new Error("未登录");
  }

  return token;
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.detail || fallback;
  } catch {
    return fallback;
  }
}

function appendParam(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  params.set(key, String(value));
}

export async function adminListComments(
  params: AdminCommentListParams = {},
): Promise<AdminCommentListResponse> {
  const token = getRequiredToken();
  const query = new URLSearchParams();

  appendParam(query, "keyword", params.keyword);
  appendParam(query, "target_type", params.targetType);
  appendParam(query, "target_id", params.targetId);
  appendParam(query, "user_id", params.userId);
  appendParam(query, "include_deleted", params.includeDeleted ?? true);
  appendParam(query, "only_deleted", params.onlyDeleted ?? false);
  appendParam(query, "has_replies", params.hasReplies);
  appendParam(query, "sort", params.sort ?? "newest");
  appendParam(query, "limit", params.limit ?? 50);
  appendParam(query, "offset", params.offset ?? 0);

  const response = await fetch(
    `${API_BASE_URL}/api/admin/interactions/comments?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "加载评论失败"));
  }

  return response.json();
}

export async function adminGetCommentTreeByCommentId(
  commentId: string,
): Promise<AdminCommentTreeItem[]> {
  const token = getRequiredToken();
  const query = new URLSearchParams();

  query.set("comment_id", commentId);
  query.set("include_deleted", "true");
  query.set("limit", "100");

  const response = await fetch(
    `${API_BASE_URL}/api/admin/interactions/comments/tree?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "加载评论上下文失败"));
  }

  return response.json();
}

export async function adminSoftDeleteComment(
  commentId: string,
): Promise<AdminCommentTreeItem> {
  const token = getRequiredToken();

  const response = await fetch(
    `${API_BASE_URL}/api/admin/interactions/comments/${commentId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "软删除评论失败"));
  }

  return response.json();
}

export async function adminHardDeleteComment(commentId: string): Promise<void> {
  const token = getRequiredToken();

  const response = await fetch(
    `${API_BASE_URL}/api/admin/interactions/comments/${commentId}/hard`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "硬删除评论失败"));
  }
}
