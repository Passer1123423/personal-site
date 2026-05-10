const API_BASE_URL = "http://127.0.0.1:8000";

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

export type ComicPartItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: string;
  visibility: string;
  displayOrder: number;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  chapters: ComicChapterItem[];
};

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
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export function getComicSeriesList() {
  return fetchJson<ComicSeriesListItem[]>(`${API_BASE_URL}/api/comics`);
}

export function getComicSeriesDetail(seriesSlug: string) {
  return fetchJson<ComicSeriesDetail>(
    `${API_BASE_URL}/api/comics/${seriesSlug}`,
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
