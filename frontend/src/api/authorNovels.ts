import { getAccessToken } from "./auth";
import { API_BASE_URL } from "./config";

export type AuthorNovelChapter = {
  id: string;
  slug: string;
  title: string;
  content: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AuthorNovel = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverAssetId: string | null;
  coverUrl: string | null;
  displayOrder: number;
  chapters: AuthorNovelChapter[];
  createdAt: string;
  updatedAt: string;
};

export type AuthorNovelBuffer = {
  id: string;
  novelId: string;
  chapterId: string | null;
  contentType: "markdown" | "plain_text";
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type MoveDirection = "up" | "down";

function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();

  if (!token) {
    throw new Error("未登录");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

function getJsonHeaders(): HeadersInit {
  return {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail ?? "请求失败");
  }

  return data as T;
}

export async function fetchAuthorNovelsTree() {
  const response = await fetch(`${API_BASE_URL}/api/author/novels/tree`, {
    headers: getAuthHeaders(),
  });

  return readJsonOrThrow<AuthorNovel[]>(response);
}

export async function createAuthorNovel(params: {
  slug: string;
  title?: string | null;
}) {
  const response = await fetch(`${API_BASE_URL}/api/author/novels/create`, {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify(params),
  });

  return readJsonOrThrow<AuthorNovel>(response);
}

export async function renameAuthorNovel(novelSlug: string, title: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${novelSlug}/rename`,
    {
      method: "PATCH",
      headers: getJsonHeaders(),
      body: JSON.stringify({ title }),
    },
  );

  return readJsonOrThrow<AuthorNovel>(response);
}

export async function updateAuthorNovelSummary(
  novelSlug: string,
  summary: string,
) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${novelSlug}/summary`,
    {
      method: "PATCH",
      headers: getJsonHeaders(),
      body: JSON.stringify({ summary }),
    },
  );

  return readJsonOrThrow<AuthorNovel>(response);
}

export async function uploadAuthorNovelCover(novelSlug: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${novelSlug}/cover`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    },
  );

  return readJsonOrThrow<AuthorNovel>(response);
}

export async function createAuthorNovelChapter(params: {
  novelSlug: string;
  slug: string;
  customTitle?: string | null;
  content?: string | null;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${params.novelSlug}/chapter/create`,
    {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify({
        slug: params.slug,
        customTitle: params.customTitle,
        content: params.content,
      }),
    },
  );

  return readJsonOrThrow<AuthorNovelChapter>(response);
}

export async function renameAuthorNovelChapter(params: {
  novelSlug: string;
  chapterSlug: string;
  customTitle?: string | null;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${params.novelSlug}/${params.chapterSlug}/rename`,
    {
      method: "PATCH",
      headers: getJsonHeaders(),
      body: JSON.stringify({ customTitle: params.customTitle }),
    },
  );

  return readJsonOrThrow<AuthorNovelChapter>(response);
}

export async function updateAuthorNovelChapterContent(params: {
  novelSlug: string;
  chapterSlug: string;
  content: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${params.novelSlug}/${params.chapterSlug}/content`,
    {
      method: "PATCH",
      headers: getJsonHeaders(),
      body: JSON.stringify({ content: params.content }),
    },
  );

  return readJsonOrThrow<AuthorNovelChapter>(response);
}

export async function moveAuthorNovelChapter(params: {
  novelSlug: string;
  chapterSlug: string;
  direction: MoveDirection;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${params.novelSlug}/${params.chapterSlug}/move`,
    {
      method: "PATCH",
      headers: getJsonHeaders(),
      body: JSON.stringify({ direction: params.direction }),
    },
  );

  return readJsonOrThrow<{
    moved: boolean;
    reason?: string;
    chapterSlug: string;
    displayOrder: number;
    targetChapterSlug?: string;
    targetDisplayOrder?: number;
  }>(response);
}

export async function deleteAuthorNovelChapter(
  novelSlug: string,
  chapterSlug: string,
) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${novelSlug}/${chapterSlug}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<{ deleted: boolean }>(response);
}

export async function deleteAuthorNovel(novelSlug: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${novelSlug}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<{ deleted: boolean }>(response);
}

export async function fetchAuthorNovelBuffers(novelSlug: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${novelSlug}/text-buffers`,
    {
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<AuthorNovelBuffer[]>(response);
}

export async function createAuthorNovelBuffer(params: {
  novelSlug: string;
  contentType: "markdown" | "plain_text";
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${params.novelSlug}/text-buffer/create`,
    {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify({ contentType: params.contentType }),
    },
  );

  return readJsonOrThrow<AuthorNovelBuffer>(response);
}

export async function loadAuthorChapterToBuffer(params: {
  novelSlug: string;
  chapterSlug: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${params.novelSlug}/${params.chapterSlug}/text-buffer/load`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<AuthorNovelBuffer>(response);
}

export async function updateAuthorNovelBuffer(params: {
  bufferId: string;
  content: string;
  contentType?: "markdown" | "plain_text" | null;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/text-buffer/${params.bufferId}`,
    {
      method: "PATCH",
      headers: getJsonHeaders(),
      body: JSON.stringify({
        content: params.content,
        contentType: params.contentType,
      }),
    },
  );

  return readJsonOrThrow<AuthorNovelBuffer>(response);
}

export async function publishAuthorBufferToExistingChapter(params: {
  novelSlug: string;
  chapterSlug: string;
  bufferId: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${params.novelSlug}/${params.chapterSlug}/text-buffer/publish`,
    {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify({ bufferId: params.bufferId }),
    },
  );

  return readJsonOrThrow<AuthorNovelChapter>(response);
}

export async function publishAuthorBufferToNewChapter(params: {
  novelSlug: string;
  bufferId: string;
  slug: string;
  customTitle?: string | null;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/${params.novelSlug}/text-buffer/publish-new-chapter`,
    {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify({
        bufferId: params.bufferId,
        slug: params.slug,
        customTitle: params.customTitle,
      }),
    },
  );

  return readJsonOrThrow<AuthorNovelChapter>(response);
}

export async function deleteAuthorNovelBuffer(bufferId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/author/novels/text-buffer/${bufferId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<{ deleted: boolean; bufferId: string }>(response);
}
