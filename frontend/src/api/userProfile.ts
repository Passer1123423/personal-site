import { API_BASE_URL } from "./config";
import { getAccessToken, type AuthUser } from "./auth";

export type UserAvatarAsset = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  usage: string;
  createdAt: string;
  isCurrent: boolean;
};

export type UpdateMyProfileParams = {
  displayName?: string;
  bio?: string;
};

function getAuthHeaders(extraHeaders?: HeadersInit): HeadersInit {
  const token = getAccessToken();

  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "请求失败");
  }

  return response.json();
}

export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_BASE_URL}${url}`;
}

export async function updateMyProfile(
  params: UpdateMyProfileParams,
): Promise<AuthUser> {
  return fetchJson<AuthUser>(`${API_BASE_URL}/api/users/me/profile`, {
    method: "PATCH",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(params),
  });
}

export async function uploadMyAvatar(file: Blob): Promise<AuthUser> {
  const formData = new FormData();
  formData.append("file", file, "avatar.webp");

  return fetchJson<AuthUser>(`${API_BASE_URL}/api/users/me/avatar`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
}

export async function listMyAvatars(): Promise<UserAvatarAsset[]> {
  return fetchJson<UserAvatarAsset[]>(`${API_BASE_URL}/api/users/me/avatars`, {
    headers: getAuthHeaders(),
  });
}

export async function switchMyAvatar(assetId: string | null): Promise<AuthUser> {
  return fetchJson<AuthUser>(`${API_BASE_URL}/api/users/me/avatar`, {
    method: "PATCH",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ assetId }),
  });
}

export async function deleteMyAvatar(
  assetId: string,
): Promise<{ deleted: boolean; assetId: string }> {
  return fetchJson<{ deleted: boolean; assetId: string }>(
    `${API_BASE_URL}/api/users/me/avatars/${assetId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );
}
