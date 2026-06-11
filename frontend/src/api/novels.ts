import { API_BASE_URL } from "./config";

export type NovelListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type NovelChapterItem = {
  id: string;
  slug: string;
  title: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type NovelOwnerItem = {
  id: string;
  username: string;
  displayName: string;
};

export type NovelDetail = NovelListItem & {
  owner: NovelOwnerItem | null;
  chapters: NovelChapterItem[];
};

export type NovelReaderData = {
  novel: {
    id: string;
    slug: string;
    title: string;
  };
  chapter: {
    id: string;
    slug: string;
    title: string;
    content: string;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    throw new Error("无法连接后端服务。");
  }

  if (response.status === 404) {
    throw new Error("请求的内容不存在。");
  }

  if (!response.ok) {
    throw new Error(`请求失败，状态码：${response.status}`);
  }

  return response.json();
}

export function getNovelList() {
  return fetchJson<NovelListItem[]>(`${API_BASE_URL}/api/novels`);
}

export function getNovelDetail(novelSlug: string) {
  return fetchJson<NovelDetail>(
    `${API_BASE_URL}/api/novels/${novelSlug}`,
  );
}

export function getNovelReaderData(novelSlug: string, chapterSlug: string) {
  return fetchJson<NovelReaderData>(
    `${API_BASE_URL}/api/novels/${novelSlug}/${chapterSlug}`,
  );
}

export function resolveAssetUrl(url: string | null) {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_BASE_URL}${url}`;
}
