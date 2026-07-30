import { getAccessToken } from "../../../api/auth";

const SABA_NOTE_API_BASE_URL =
  import.meta.env.VITE_SABA_NOTE_API_BASE_URL ?? "http://127.0.0.1:18003";

export class SabaNoteApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(
    message: string,
    status: number,
    body: unknown,
  ) {
    super(message);
    this.name = "SabaNoteApiError";
    this.status = status;
    this.body = body;
  }
}

export async function sabaNoteRequest<T>(
  path: string,
  options: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<T> {
  const { body, headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders);
  const token = getAccessToken();

  headers.set("Accept", "application/json");
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${SABA_NOTE_API_BASE_URL}${path}`, {
    ...requestOptions,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const responseBody =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);

  if (!response.ok) {
    const detail =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "detail" in responseBody
        ? String(responseBody.detail)
        : `Saba-Note API 请求失败：${response.status}`;

    throw new SabaNoteApiError(detail, response.status, responseBody);
  }

  return responseBody as T;
}
