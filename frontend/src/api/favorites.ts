import { getAccessToken } from "./auth";
import { API_BASE_URL } from "./config";

export type FavoriteState = {
  targetType: "novel" | "comic_part";
  targetId: string;
  slug?: string;
  seriesSlug?: string;
  partSlug?: string;
  title: string;
  isFavorited: boolean;
  favoriteId?: string | null;
};

function getAuthHeaders() {
  const token = getAccessToken();

  if (!token) {
    throw new Error("请先登录后再收藏。");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function fetchFavoriteJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("无法连接后端服务。");
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("请先登录后再收藏。");
  }

  if (response.status === 404) {
    throw new Error("收藏目标不存在。");
  }

  if (!response.ok) {
    throw new Error(`收藏操作失败，状态码：${response.status}`);
  }

  return response.json();
}

export function getNovelFavoriteState(novelSlug: string) {
  return fetchFavoriteJson<FavoriteState>(
    `${API_BASE_URL}/api/favorites/novels/${novelSlug}`,
  );
}

export function favoriteNovel(novelSlug: string) {
  return fetchFavoriteJson<FavoriteState>(
    `${API_BASE_URL}/api/favorites/novels/${novelSlug}`,
    {
      method: "POST",
    },
  );
}

export function unfavoriteNovel(novelSlug: string) {
  return fetchFavoriteJson<FavoriteState>(
    `${API_BASE_URL}/api/favorites/novels/${novelSlug}`,
    {
      method: "DELETE",
    },
  );
}

export function getComicPartFavoriteState(
  seriesSlug: string,
  partSlug: string,
) {
  return fetchFavoriteJson<FavoriteState>(
    `${API_BASE_URL}/api/favorites/comics/${seriesSlug}/${partSlug}`,
  );
}

export function favoriteComicPart(seriesSlug: string, partSlug: string) {
  return fetchFavoriteJson<FavoriteState>(
    `${API_BASE_URL}/api/favorites/comics/${seriesSlug}/${partSlug}`,
    {
      method: "POST",
    },
  );
}

export function unfavoriteComicPart(seriesSlug: string, partSlug: string) {
  return fetchFavoriteJson<FavoriteState>(
    `${API_BASE_URL}/api/favorites/comics/${seriesSlug}/${partSlug}`,
    {
      method: "DELETE",
    },
  );
}
