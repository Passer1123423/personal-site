import { API_BASE_URL } from "./config";

const TOKEN_KEY = "personal_site_access_token";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
  bio: string;
  createdAt: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
};

export type RegisterParams = {
  username: string;
  displayName: string;
  password: string;
};

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "登录失败");
  }

  return response.json();
}

export async function getMe(): Promise<AuthUser> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "获取当前用户失败");
  }

  return response.json();
}

export function saveAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("auth-changed"));
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("auth-changed"));
}

export async function register(params: RegisterParams): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: params.username,
      displayName: params.displayName,
      password: params.password,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "注册失败");
  }

  return response.json();
}