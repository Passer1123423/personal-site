import { getAccessToken } from "../../../api/auth";
import { API_BASE_URL } from "../../../api/config";

export class SabaNoteSessionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SabaNoteSessionError";
    this.status = status;
  }
}

export async function verifySabaNoteSession() {
  const token = getAccessToken();

  if (!token) {
    throw new SabaNoteSessionError("未登录", 401);
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new SabaNoteSessionError(
      body?.detail ?? "无法确认登录状态",
      response.status,
    );
  }
}
