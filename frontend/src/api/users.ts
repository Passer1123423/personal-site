import { API_BASE_URL } from "./config";

export type PublicUserProfile = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  role: string;
  series: [];
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "请求失败");
  }

  return response.json();
}

export async function getUserProfile(
  username: string,
): Promise<PublicUserProfile> {
  return fetchJson<PublicUserProfile>(
    `${API_BASE_URL}/api/users/${username}`,
  );
}