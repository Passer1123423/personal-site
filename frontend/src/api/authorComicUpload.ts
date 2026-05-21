import { getAccessToken } from "./auth";

import { API_BASE_URL } from "./config";

function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();

  if (!token) {
    throw new Error("未登录");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail ?? "请求失败");
  }

  return data as T;
}

export type AuthorUploadImage = {
  id: string;
  originalFilename: string;
  storedFilename: string;
  contentType: string | null;
  sizeBytes: number;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  previewUrl: string;
};

export type AuthorUploadState = {
  images: AuthorUploadImage[];
  totalSizeBytes: number;
  limitBytes: number;
};

export type UploadImagesResult = {
  saved: AuthorUploadImage[];
  rejected: {
    filename: string;
    reason: string;
  }[];
  totalSizeBytes: number;
  limitBytes: number;
};

export type PublishComicChapterPayload = {
  series_slug: string;
  part_slug: string;
  chapter_title?: string | null;
  ordered_image_ids?: string[] | null;
};

export type PublishComicChapterResult = {
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
    displayOrder: number;
    visibility: string;
  };
  pageCount: number;
};

export async function listAuthorUploadImages(): Promise<AuthorUploadState> {
  const response = await fetch(`${API_BASE_URL}/api/author/comic-upload/images`, {
    headers: getAuthHeaders(),
  });

  return readJsonOrThrow<AuthorUploadState>(response);
}

export async function uploadAuthorComicImages(
  files: File[],
): Promise<UploadImagesResult> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch(`${API_BASE_URL}/api/author/comic-upload/images`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return readJsonOrThrow<UploadImagesResult>(response);
}

export async function deleteAuthorUploadImage(
  imageId: string,
): Promise<AuthorUploadState> {
  const response = await fetch(
    `${API_BASE_URL}/api/author/comic-upload/images/${imageId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<AuthorUploadState>(response);
}

export async function clearAuthorUploadImages(): Promise<AuthorUploadState> {
  const response = await fetch(`${API_BASE_URL}/api/author/comic-upload/images`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  return readJsonOrThrow<AuthorUploadState>(response);
}

export async function publishAuthorComicChapter(
  payload: PublishComicChapterPayload,
): Promise<PublishComicChapterResult> {
  const response = await fetch(`${API_BASE_URL}/api/author/comic-upload/publish`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return readJsonOrThrow<PublishComicChapterResult>(response);
}

export async function fetchAuthorUploadPreviewObjectUrl(
  previewUrl: string,
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${previewUrl}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "预览图片加载失败");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}