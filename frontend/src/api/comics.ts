import { API_BASE_URL } from "./config";

export type ComicSeriesListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: string;
  visibility: string;
  displayOrder: number;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComicChapterItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  visibility: string;
  displayOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComicOwnerItem = {
  id: string;
  username: string;
  displayName: string;
};

export type ComicPartItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: string;
  visibility: string;
  displayOrder: number;
  coverUrl: string | null;
  owner: ComicOwnerItem | null;
  createdAt: string;
  updatedAt: string;
  chapters: ComicChapterItem[];
};

export type ComicPartDetailPart = Omit<ComicPartItem, "chapters">;

export type ComicSeriesDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: string;
  visibility: string;
  displayOrder: number;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  parts: ComicPartItem[];
};

export type ComicPartDetailResponse = {
  series: {
    id: string;
    slug: string;
    title: string;
  };
  part: ComicPartDetailPart;
  chapters: ComicChapterItem[];
};

export type ComicReaderPage = {
  id: string;
  displayOrder: number;
  imageUrl: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ComicReaderData = {
  series: {
    id: string;
    slug: string;
    title: string;
  };
  part: {
    id: string;
    slug: string;
    title: string;
  };
  chapter: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  pageCount: number;
  pages: ComicReaderPage[];
};

async function fetchJson<T>(url: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(url)
  } catch {
    throw new Error('无法连接后端服务。')
  }

  if (response.status === 404) {
    throw new Error('请求的内容不存在。')
  }

  if (!response.ok) {
    throw new Error(`请求失败，状态码：${response.status}`)
  }

  return response.json()
}

export function getComicSeriesList() {
  return fetchJson<ComicSeriesListItem[]>(`${API_BASE_URL}/api/comics`);
}

export function getComicSeriesDetail(seriesSlug: string) {
  return fetchJson<ComicSeriesDetail>(
    `${API_BASE_URL}/api/comics/${seriesSlug}`,
  );
}

export function getComicPartDetail(seriesSlug: string, partSlug: string) {
  return fetchJson<ComicPartDetailResponse>(
    `${API_BASE_URL}/api/comics/${seriesSlug}/${partSlug}`,
  );
}

export function getComicReaderData(
  seriesSlug: string,
  partSlug: string,
  chapterSlug: string,
) {
  return fetchJson<ComicReaderData>(
    `${API_BASE_URL}/api/comics/${seriesSlug}/${partSlug}/${chapterSlug}`,
  );
}

export function resolveAssetUrl(url: string | null) {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_BASE_URL}${url}`;
}
