import { getAccessToken } from "./auth";

import { API_BASE_URL } from "./config";

export type AuthorComicChapter = {
  id: string;
  slug: string;
  title: string;
  visibility: string;
  displayOrder: number;
  pageCount: number;
};

export type AuthorComicOwner = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
};

export type AuthorComicPart = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  coverUrl?: string | null;
  visibility: string;
  displayOrder: number;
  owner: AuthorComicOwner | null;
  chapters: AuthorComicChapter[];
};

export type AuthorComicSeries = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  coverUrl?: string | null;
  visibility: string;
  displayOrder: number;
  parts: AuthorComicPart[];
};

export type AuthorComicPartDetail = {
  series: {
    id: string;
    slug: string;
    title: string;
    visibility: string;
    displayOrder: number;
  };
  part: AuthorComicPart;
  chapters: AuthorComicChapter[];
};

export type MoveDirection = "up" | "down";

export type CreateAuthorComicSeriesResult = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  visibility: string;
  displayOrder: number;
};

export type CreateAuthorComicPartResult = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  visibility: string;
  displayOrder: number;
  owner: AuthorComicOwner | null;
};

const AUTHOR_COMICS_API = `${API_BASE_URL}/api/author/comics`;

function getAuthorHeaders(extraHeaders?: HeadersInit): HeadersInit {
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

export async function fetchAuthorComicsTree() {
  return fetchJson<AuthorComicSeries[]>(
    `${AUTHOR_COMICS_API}/tree`,
    {
      headers: getAuthorHeaders(),
    },
  );
}

export async function fetchAuthorComicPartDetail(
  seriesSlug: string,
  partSlug: string,
): Promise<AuthorComicPartDetail> {
  const tree = await fetchAuthorComicsTree();

  const series = tree.find((item) => item.slug === seriesSlug);

  if (!series) {
    throw new Error(`未找到 series：${seriesSlug}`);
  }

  const part = series.parts.find((item) => item.slug === partSlug);

  if (!part) {
    throw new Error(`未找到 part：${partSlug}`);
  }

  return {
    series: {
      id: series.id,
      slug: series.slug,
      title: series.title,
      visibility: series.visibility,
      displayOrder: series.displayOrder,
    },
    part,
    chapters: part.chapters,
  };
}

export async function renameAuthorComicChapter(params: {
  seriesSlug: string;
  partSlug: string;
  chapterSlug: string;
  customTitle: string;
}) {
  return fetchJson(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/${params.partSlug}/${params.chapterSlug}/rename`,
    {
      method: "PATCH",
      headers: getAuthorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        customTitle: params.customTitle,
      }),
    },
  );
}

export async function moveAuthorComicChapter(params: {
  seriesSlug: string;
  partSlug: string;
  chapterSlug: string;
  direction: MoveDirection;
}) {
  return fetchJson<{
    moved: boolean;
    reason?: string;
    chapterSlug: string;
    displayOrder: number;
    targetChapterSlug?: string;
    targetDisplayOrder?: number;
  }>(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/${params.partSlug}/${params.chapterSlug}/move`,
    {
      method: "PATCH",
      headers: getAuthorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        direction: params.direction,
      }),
    },
  );
}

export async function deleteAuthorComicChapter(params: {
  seriesSlug: string;
  partSlug: string;
  chapterSlug: string;
}) {
  return fetchJson(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/${params.partSlug}/${params.chapterSlug}`,
    {
      method: "DELETE",
      headers: getAuthorHeaders(),
    },
  );
}

export async function updateAuthorPartSummary(params: {
  seriesSlug: string;
  partSlug: string;
  summary: string;
}) {
  return fetchJson<AuthorComicPart>(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/${params.partSlug}/summary`,
    {
      method: "PATCH",
      headers: getAuthorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        summary: params.summary,
      }),
    },
  );
}

export async function uploadAuthorPartCover(params: {
  seriesSlug: string;
  partSlug: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("file", params.file);

  return fetchJson<AuthorComicPart>(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/${params.partSlug}/cover`,
    {
      method: "POST",
      headers: getAuthorHeaders(),
      body: formData,
    },
  );
}

export async function updateAuthorSeriesSummary(params: {
  seriesSlug: string;
  summary: string;
}) {
  return fetchJson<AuthorComicSeries>(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/summary`,
    {
      method: "PATCH",
      headers: getAuthorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        summary: params.summary,
      }),
    },
  );
}

export async function uploadAuthorSeriesCover(params: {
  seriesSlug: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("file", params.file);

  return fetchJson<AuthorComicSeries>(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/cover`,
    {
      method: "POST",
      headers: getAuthorHeaders(),
      body: formData,
    },
  );
}

export async function renameAuthorComicSeries(params: {
  seriesSlug: string;
  title: string;
}) {
  return fetchJson<AuthorComicSeries>(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/rename`,
    {
      method: "PATCH",
      headers: getAuthorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        title: params.title,
      }),
    },
  );
}

export async function renameAuthorComicPart(params: {
  seriesSlug: string;
  partSlug: string;
  title: string;
}) {
  return fetchJson<AuthorComicPart>(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/${params.partSlug}/rename`,
    {
      method: "PATCH",
      headers: getAuthorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        title: params.title,
      }),
    },
  );
}

export async function createAuthorComicSeries(params: {
  slug: string;
  title?: string;
  summary?: string;
}) {
  return fetchJson<AuthorComicSeries>(
    `${AUTHOR_COMICS_API}/series/create`,
    {
      method: "POST",
      headers: getAuthorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        slug: params.slug,
        title: params.title?.trim() || null,
        summary: params.summary?.trim() || null,
      }),
    },
  );
}

export async function createAuthorComicPart(params: {
  seriesSlug: string;
  slug: string;
  title?: string;
  summary?: string;
}) {
  return fetchJson<CreateAuthorComicPartResult>(
    `${AUTHOR_COMICS_API}/${params.seriesSlug}/part/create`,
    {
      method: "POST",
      headers: getAuthorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        slug: params.slug,
        title: params.title?.trim() || null,
        summary: params.summary?.trim() || null,
      }),
    },
  );
}