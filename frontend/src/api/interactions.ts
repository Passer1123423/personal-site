import { API_BASE_URL } from "./config";
import { getAccessToken } from "./auth";

export type CommentUser = {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
};

export type CommentItem = {
  id: string;
  target_type: string;
  target_id: string;
  user_id: string;
  user: CommentUser | null;
  content: string;
  parent_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  children: CommentItem[];
};

export type CreateCommentParams = {
  targetType: string;
  targetId: string;
  content: string;
  parentId?: string | null;
};

export type ListCommentTreeParams = {
  targetType: string;
  targetId: string;
  limit?: number;
  offset?: number;
};

export type AdminListCommentTreeParams = {
  commentId?: string;
  targetType?: string;
  targetId?: string;
  userId?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
};

function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function readErrorMessage(response: Response, fallback: string) {
  const error = await response.json().catch(() => null);

  if (typeof error?.detail === "string") {
    return error.detail;
  }

  if (Array.isArray(error?.detail)) {
    return error.detail
      .map((item: { msg?: string }) => item.msg)
      .filter(Boolean)
      .join("；") || fallback;
  }

  return fallback;
}

function getRequiredToken() {
  const token = getAccessToken();

  if (!token) {
    throw new Error("未登录");
  }

  return token;
}

export async function listCommentTree(
  params: ListCommentTreeParams,
): Promise<CommentItem[]> {
  const query = buildQuery({
    target_type: params.targetType,
    target_id: params.targetId,
    limit: params.limit,
    offset: params.offset,
  });

  const response = await fetch(`${API_BASE_URL}/api/interactions/comments/tree${query}`);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "获取评论失败"));
  }

  return response.json();
}

export async function createComment(
  params: CreateCommentParams,
): Promise<CommentItem> {
  const token = getRequiredToken();

  const response = await fetch(`${API_BASE_URL}/api/interactions/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      target_type: params.targetType,
      target_id: params.targetId,
      content: params.content,
      parent_id: params.parentId ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "发表评论失败"));
  }

  return response.json();
}

export async function deleteOwnComment(commentId: string): Promise<CommentItem> {
  const token = getRequiredToken();

  const response = await fetch(`${API_BASE_URL}/api/interactions/comments/${commentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "删除评论失败"));
  }

  return response.json();
}

export async function adminListCommentTree(
  params: AdminListCommentTreeParams = {},
): Promise<CommentItem[]> {
  const token = getRequiredToken();

  const query = buildQuery({
    comment_id: params.commentId,
    target_type: params.targetType,
    target_id: params.targetId,
    user_id: params.userId,
    include_deleted: params.includeDeleted,
    limit: params.limit,
    offset: params.offset,
  });

  const response = await fetch(`${API_BASE_URL}/api/admin/interactions/comments/tree${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "获取评论管理列表失败"));
  }

  return response.json();
}

export async function adminGetComment(commentId: string): Promise<CommentItem> {
  const token = getRequiredToken();

  const response = await fetch(`${API_BASE_URL}/api/admin/interactions/comments/${commentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "获取评论详情失败"));
  }

  return response.json();
}

export async function adminSoftDeleteComment(commentId: string): Promise<CommentItem> {
  const token = getRequiredToken();

  const response = await fetch(`${API_BASE_URL}/api/admin/interactions/comments/${commentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "软删除评论失败"));
  }

  return response.json();
}

export async function adminHardDeleteComment(commentId: string): Promise<{
  deleted: boolean;
  comment_id: string;
}> {
  const token = getRequiredToken();

  const response = await fetch(`${API_BASE_URL}/api/admin/interactions/comments/${commentId}/hard`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "硬删除评论失败"));
  }

  return response.json();
}
