import { getAccessToken } from "./auth";

const API_BASE_URL = "http://127.0.0.1:18001";

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  role: "reader" | "author" | "admin";
  isActive: boolean;
  avatarUrl: string | null;
  bio: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAdminUserParams = {
  username: string;
  displayName: string;
  password: string;
  role: "reader" | "author" | "admin";
  bio?: string;
};

export type UpdateAdminUserParams = {
  displayName?: string;
  role?: "reader" | "author" | "admin";
  isActive?: boolean;
  bio?: string;
};

export type ResetAdminUserPasswordParams = {
  password: string;
};

export type DeleteAdminUserParams = {
  confirmUsername: string;
  adminPassword: string;
};

function getAdminHeaders(extraHeaders?: HeadersInit): HeadersInit {
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

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return fetchJson<AdminUser[]>(`${API_BASE_URL}/api/admin/users`, {
    headers: getAdminHeaders(),
  });
}

export async function createAdminUser(
  params: CreateAdminUserParams,
): Promise<AdminUser> {
  return fetchJson<AdminUser>(`${API_BASE_URL}/api/admin/users`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      username: params.username,
      displayName: params.displayName,
      password: params.password,
      role: params.role,
      bio: params.bio ?? "",
    }),
  });
}

export async function updateAdminUser(
  username: string,
  params: UpdateAdminUserParams,
): Promise<AdminUser> {
  return fetchJson<AdminUser>(`${API_BASE_URL}/api/admin/users/${username}`, {
    method: "PATCH",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(params),
  });
}

export async function resetAdminUserPassword(
  username: string,
  params: ResetAdminUserPasswordParams,
): Promise<AdminUser> {
  return fetchJson<AdminUser>(
    `${API_BASE_URL}/api/admin/users/${username}/password`,
    {
      method: "PATCH",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(params),
    },
  );
}

export async function deleteAdminUser(
  username: string,
  params: DeleteAdminUserParams,
): Promise<{ deleted: boolean; username: string }> {
  return fetchJson<{ deleted: boolean; username: string }>(
    `${API_BASE_URL}/api/admin/users/${username}`,
    {
      method: "DELETE",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(params),
    },
  );
}