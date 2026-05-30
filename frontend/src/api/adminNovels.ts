import { getAccessToken } from "./auth";
import { API_BASE_URL } from "./config";

export type AdminNovelOwner = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
};

export type AdminNovelChapter = {
  id: string;
  slug: string;
  title: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminNovel = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  displayOrder: number;
  owner: AdminNovelOwner | null;
  chapters: AdminNovelChapter[];
  createdAt: string;
  updatedAt: string;
};

function getAdminHeaders(extraHeaders?: HeadersInit): HeadersInit {
  const token = getAccessToken();

  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("无法连接后端服务。");
  }

  if (!response.ok) {
    let message = `请求失败，状态码：${response.status}`;

    try {
      const data = await response.json();
      if (data?.detail) {
        message = data.detail;
      }
    } catch {
      // 忽略非 JSON 错误响应
    }

    throw new Error(message);
  }

  return response.json();
}

export async function fetchAdminNovelsTree() {
  return fetchJson<AdminNovel[]>(`${API_BASE_URL}/api/admin/novels/tree`, {
    headers: getAdminHeaders(),
  });
}

export async function fetchAdminNovelOwnerCandidates(): Promise<
  AdminNovelOwner[]
> {
  return fetchJson<AdminNovelOwner[]>(
    `${API_BASE_URL}/api/admin/novels/owner-candidates`,
    {
      headers: getAdminHeaders(),
    },
  );
}

export async function createAdminNovel(params: {
  slug: string;
  title?: string;
}) {
  return fetchJson<AdminNovel>(`${API_BASE_URL}/api/admin/novels/create`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      slug: params.slug,
      title: params.title,
    }),
  });
}

export async function createAdminNovelChapter(params: {
  novelSlug: string;
  slug: string;
  customTitle?: string;
  content?: string;
}) {
  return fetchJson<AdminNovelChapter>(
    `${API_BASE_URL}/api/admin/novels/${params.novelSlug}/chapter/create`,
    {
      method: "POST",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        slug: params.slug,
        customTitle: params.customTitle,
        content: params.content ?? "",
      }),
    },
  );
}

export async function renameAdminNovel(params: {
  novelSlug: string;
  title: string;
}) {
  return fetchJson<AdminNovel>(
    `${API_BASE_URL}/api/admin/novels/${params.novelSlug}/rename`,
    {
      method: "PATCH",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        title: params.title,
      }),
    },
  );
}

export async function renameAdminNovelChapter(params: {
  novelSlug: string;
  chapterSlug: string;
  customTitle: string;
}) {
  return fetchJson<AdminNovelChapter>(
    `${API_BASE_URL}/api/admin/novels/${params.novelSlug}/${params.chapterSlug}/rename`,
    {
      method: "PATCH",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        customTitle: params.customTitle,
      }),
    },
  );
}

export async function moveAdminNovelChapter(params: {
  novelSlug: string;
  chapterSlug: string;
  direction: "up" | "down";
}) {
  return fetchJson<{
    moved: boolean;
    reason?: string;
    chapterSlug: string;
    displayOrder: number;
    targetChapterSlug?: string;
    targetDisplayOrder?: number;
  }>(
    `${API_BASE_URL}/api/admin/novels/${params.novelSlug}/${params.chapterSlug}/move`,
    {
      method: "PATCH",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        direction: params.direction,
      }),
    },
  );
}

export async function setAdminNovelOwner(params: {
  novelSlug: string;
  username: string | null;
}) {
  return fetchJson(
    `${API_BASE_URL}/api/admin/novels/${params.novelSlug}/owner`,
    {
      method: "PATCH",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        username: params.username,
      }),
    },
  );
}

export async function deleteAdminNovelChapter(params: {
  novelSlug: string;
  chapterSlug: string;
}) {
  return fetchJson(
    `${API_BASE_URL}/api/admin/novels/${params.novelSlug}/${params.chapterSlug}`,
    {
      method: "DELETE",
      headers: getAdminHeaders(),
    },
  );
}

export async function deleteAdminNovel(params: { novelSlug: string }) {
  return fetchJson(`${API_BASE_URL}/api/admin/novels/${params.novelSlug}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}
