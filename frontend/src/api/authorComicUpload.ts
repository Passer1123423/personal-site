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

export type ComicUploadMode = "new_chapter" | "edit_chapter";

export type AuthorUploadImage = {
  id: string;
  targetPartId: string | null;
  targetChapterId: string | null;
  uploadMode: ComicUploadMode;
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
  uploadMode: ComicUploadMode;
  targetPartId: string | null;
  targetChapterId: string | null;
  targetInconsistent?: boolean;
};

export type UploadImagesResult = {
  saved: AuthorUploadImage[];
  rejected: {
    filename: string;
    reason: string;
  }[];
  totalSizeBytes: number;
  limitBytes: number;
  uploadMode: ComicUploadMode;
  targetPartId: string | null;
  targetChapterId: string | null;
  targetInconsistent?: boolean;
};

export type UploadComicImageBatchInfo = {
  uploadBatchId?: string;
  uploadBatchIndex?: number;
  uploadBatchTotal?: number;
  uploadMode?: ComicUploadMode;
  seriesSlug?: string;
  partSlug?: string;
  chapterSlug?: string;
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

function appendUploadTargetFormData(
  formData: FormData,
  batchInfo: UploadComicImageBatchInfo,
) {
  if (batchInfo.uploadMode) {
    formData.append("upload_mode", batchInfo.uploadMode);
  }

  if (batchInfo.seriesSlug) {
    formData.append("series_slug", batchInfo.seriesSlug);
  }

  if (batchInfo.partSlug) {
    formData.append("part_slug", batchInfo.partSlug);
  }

  if (batchInfo.chapterSlug) {
    formData.append("chapter_slug", batchInfo.chapterSlug);
  }
}

export async function uploadAuthorComicImages(
  files: File[],
  batchInfo: UploadComicImageBatchInfo = {},
): Promise<UploadImagesResult> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  appendUploadTargetFormData(formData, batchInfo);

  const response = await fetch(`${API_BASE_URL}/api/author/comic-upload/images`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return readJsonOrThrow<UploadImagesResult>(response);
}

export function uploadAuthorComicImageWithProgress(
  file: File,
  onProgress: (progress: number) => void,
  batchInfo: UploadComicImageBatchInfo = {},
): Promise<UploadImagesResult> {
  return new Promise((resolve, reject) => {
    const token = getAccessToken();

    if (!token) {
      reject(new Error("未登录"));
      return;
    }

    const formData = new FormData();
    formData.append("files", file);

    if (batchInfo.uploadBatchId) {
      formData.append("upload_batch_id", batchInfo.uploadBatchId);
    }

    if (typeof batchInfo.uploadBatchIndex === "number") {
      formData.append("upload_batch_index", String(batchInfo.uploadBatchIndex));
    }

    if (typeof batchInfo.uploadBatchTotal === "number") {
      formData.append("upload_batch_total", String(batchInfo.uploadBatchTotal));
    }

    appendUploadTargetFormData(formData, batchInfo);

    const xhr = new XMLHttpRequest();

    xhr.open("POST", `${API_BASE_URL}/api/author/comic-upload/images`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(Math.min(100, Math.max(0, progress)));
    };

    xhr.onload = () => {
      const data = (() => {
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return null;
        }
      })();

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data?.detail ?? "上传失败"));
        return;
      }

      onProgress(100);
      resolve(data as UploadImagesResult);
    };

    xhr.onerror = () => {
      reject(new Error("无法连接后端服务。"));
    };

    xhr.onabort = () => {
      reject(new Error("上传已取消。"));
    };

    xhr.send(formData);
  });
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