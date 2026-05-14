const API_BASE_URL = "http://127.0.0.1:18001";

export type AdminComicChapter = {
  id: string;
  slug: string;
  title: string;
  visibility: string;
  displayOrder: number;
  pageCount: number;
};

export type AdminComicPart = {
  id: string;
  slug: string;
  title: string;
  visibility: string;
  displayOrder: number;
  chapters: AdminComicChapter[];
};

export type AdminComicSeries = {
  id: string;
  slug: string;
  title: string;
  visibility: string;
  displayOrder: number;
  parts: AdminComicPart[];
};

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

export async function fetchAdminComicsTree() {
  return fetchJson<AdminComicSeries[]>(`${API_BASE_URL}/api/admin/comics/tree`);
}

export async function uploadAdminComicChapter(params: {
  seriesSlug: string;
  partSlug: string;
  seriesTitle?: string;
  partTitle?: string;
  chapterTitle: string;
  files: File[];
}) {
  const formData = new FormData();

  formData.append("series_slug", params.seriesSlug);
  formData.append("part_slug", params.partSlug);

  if (params.seriesTitle?.trim()) {
    formData.append("series_title", params.seriesTitle.trim());
  }

  if (params.partTitle?.trim()) {
    formData.append("part_title", params.partTitle.trim());
  }

  if (params.chapterTitle.trim()) {
    formData.append("chapter_title", params.chapterTitle.trim());
  }

  for (const file of params.files) {
    formData.append("files", file);
  }

  return fetchJson(`${API_BASE_URL}/api/admin/comics/chapters`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteAdminComicChapter(params: {
  seriesSlug: string;
  partSlug: string;
  chapterSlug: string;
}) {
  return fetchJson(
    `${API_BASE_URL}/api/admin/comics/${params.seriesSlug}/${params.partSlug}/${params.chapterSlug}`,
    {
      method: "DELETE",
    }
  );
}

export async function deleteAdminComicPart(params: {
  seriesSlug: string;
  partSlug: string;
}) {
  return fetchJson(
    `${API_BASE_URL}/api/admin/comics/${params.seriesSlug}/${params.partSlug}`,
    {
      method: "DELETE",
    }
  );
}

export async function deleteAdminComicSeries(params: {
  seriesSlug: string;
}) {
  return fetchJson(
    `${API_BASE_URL}/api/admin/comics/${params.seriesSlug}`,
    {
      method: "DELETE",
    }
  );
}

export async function moveAdminComicChapter(params: {
  seriesSlug: string;
  partSlug: string;
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
    `${API_BASE_URL}/api/admin/comics/${params.seriesSlug}/${params.partSlug}/${params.chapterSlug}/move`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        direction: params.direction,
      }),
    }
  );
}