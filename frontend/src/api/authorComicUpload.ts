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

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : "请求失败";

    throw new ApiError(response.status, detail);
  }

  return data as T;
}

export function isComicUploadBusyError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.detail.includes("PDF 导入任务")
  );
}

export function getComicUploadBusyMessage(): string {
  return "PDF 正在导入中，待传区暂时锁定。完成或取消后就可以继续操作。";
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

export type AuthorComicPdfJobStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "canceling"
  | "canceled";

export type AuthorComicPdfJob = {
  id: string;
  kind: string;
  status: AuthorComicPdfJobStatus;
  originalFilename: string;
  totalPages: number | null;
  processedPages: number;
  progress: number;
  message: string | null;
  errorMessage: string | null;
  targetPartId: string | null;
  uploadMode: ComicUploadMode;
  createdImageIds: string[];
  createdSizeBytes: number;
  outputPages: {
    page: number;
    filename: string;
    relativePath: string;
    sizeBytes: number;
  }[];
  outputSizeBytes: number;
  mergedAt: string | null;
  mergedImageIds: string[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  canceledAt: string | null;
};

export type AuthorComicPdfJobsResult = {
  jobs: AuthorComicPdfJob[];
  activeJob: AuthorComicPdfJob | null;
};

export type MergeAuthorComicPdfJobResult = {
  job: AuthorComicPdfJob;
  uploadState: AuthorUploadState;
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

export type LoadComicChapterUploadPayload = {
  series_slug: string;
  part_slug: string;
  chapter_slug: string;
};

export type PublishComicChapterUpdatePayload = {
  series_slug: string;
  part_slug: string;
  chapter_slug: string;
  ordered_image_ids?: string[] | null;
};

export type ReorderUploadImagesPayload = {
  ordered_image_ids: string[];
};

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

export async function uploadAuthorComicPdf(
  file: File,
  payload: {
    seriesSlug?: string;
    partSlug?: string;
  } = {},
): Promise<AuthorUploadState> {
  const formData = new FormData();
  formData.append("file", file);

  if (payload.seriesSlug) {
    formData.append("series_slug", payload.seriesSlug);
  }

  if (payload.partSlug) {
    formData.append("part_slug", payload.partSlug);
  }

  const response = await fetch(`${API_BASE_URL}/api/author/comic-upload/pdf`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return readJsonOrThrow<AuthorUploadState>(response);
}

export async function listAuthorComicPdfJobs(
  options: {
    activeOnly?: boolean;
    limit?: number;
  } = {},
): Promise<AuthorComicPdfJobsResult> {
  const params = new URLSearchParams();

  if (options.activeOnly) {
    params.set("active_only", "true");
  }

  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${API_BASE_URL}/api/author/comic-upload/pdf-jobs?${queryString}`
    : `${API_BASE_URL}/api/author/comic-upload/pdf-jobs`;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  return readJsonOrThrow<AuthorComicPdfJobsResult>(response);
}

export async function getAuthorComicPdfJob(
  jobId: string,
): Promise<AuthorComicPdfJob> {
  const response = await fetch(
    `${API_BASE_URL}/api/author/comic-upload/pdf-jobs/${jobId}`,
    {
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<AuthorComicPdfJob>(response);
}

export async function cancelAuthorComicPdfJob(
  jobId: string,
): Promise<AuthorComicPdfJob> {
  const response = await fetch(
    `${API_BASE_URL}/api/author/comic-upload/pdf-jobs/${jobId}/cancel`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<AuthorComicPdfJob>(response);
}

export async function mergeAuthorComicPdfJob(
  jobId: string,
): Promise<MergeAuthorComicPdfJobResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/author/comic-upload/pdf-jobs/${jobId}/merge`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<MergeAuthorComicPdfJobResult>(response);
}

export async function discardAuthorComicPdfJob(
  jobId: string,
): Promise<AuthorComicPdfJob> {
  const response = await fetch(
    `${API_BASE_URL}/api/author/comic-upload/pdf-jobs/${jobId}/discard`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );

  return readJsonOrThrow<AuthorComicPdfJob>(response);
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

export function uploadAuthorComicPdfWithProgress(
  file: File,
  payload: {
    seriesSlug?: string;
    partSlug?: string;
    onProgress?: (progress: number) => void;
  } = {},
): Promise<AuthorUploadState> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    if (payload.seriesSlug) {
      formData.append("series_slug", payload.seriesSlug);
    }

    if (payload.partSlug) {
      formData.append("part_slug", payload.partSlug);
    }

    const request = new XMLHttpRequest();

    request.open("POST", `${API_BASE_URL}/api/author/comic-upload/pdf`);

    const authHeaders = getAuthHeaders();

    for (const [key, value] of Object.entries(authHeaders)) {
      request.setRequestHeader(key, value);
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = Math.round((event.loaded / event.total) * 100);
      payload.onProgress?.(progress);
    };

    request.onload = () => {
      let parsed: unknown = null;

      try {
        parsed = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        reject(new Error("PDF 导入响应解析失败"));
        return;
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(parsed as AuthorUploadState);
        return;
      }

      const detail =
        parsed &&
        typeof parsed === "object" &&
        "detail" in parsed &&
        typeof (parsed as { detail?: unknown }).detail === "string"
          ? (parsed as { detail: string }).detail
          : "PDF 导入失败";

      reject(new Error(detail));
    };

    request.onerror = () => {
      reject(new Error("PDF 导入请求失败"));
    };

    request.onabort = () => {
      reject(new Error("PDF 导入已取消"));
    };

    request.send(formData);
  });
}

export function createAuthorComicPdfJobWithProgress(
  file: File,
  payload: {
    seriesSlug?: string;
    partSlug?: string;
    onProgress?: (progress: number) => void;
  } = {},
): Promise<AuthorComicPdfJob> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    if (payload.seriesSlug) {
      formData.append("series_slug", payload.seriesSlug);
    }

    if (payload.partSlug) {
      formData.append("part_slug", payload.partSlug);
    }

    const request = new XMLHttpRequest();

    request.open("POST", `${API_BASE_URL}/api/author/comic-upload/pdf-jobs`);

    const authHeaders = getAuthHeaders();

    for (const [key, value] of Object.entries(authHeaders)) {
      request.setRequestHeader(key, value);
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = Math.round((event.loaded / event.total) * 100);
      payload.onProgress?.(Math.min(100, Math.max(0, progress)));
    };

    request.onload = () => {
      let parsed: unknown = null;

      try {
        parsed = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        reject(new Error("PDF 导入任务响应解析失败"));
        return;
      }

      if (request.status >= 200 && request.status < 300) {
        payload.onProgress?.(100);
        resolve(parsed as AuthorComicPdfJob);
        return;
      }

      const detail =
        parsed &&
        typeof parsed === "object" &&
        "detail" in parsed &&
        typeof (parsed as { detail?: unknown }).detail === "string"
          ? (parsed as { detail: string }).detail
          : "PDF 导入任务创建失败";

      reject(new ApiError(request.status, detail));
    };

    request.onerror = () => {
      reject(new Error("PDF 导入任务请求失败"));
    };

    request.onabort = () => {
      reject(new Error("PDF 导入任务已取消"));
    };

    request.send(formData);
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

export async function loadAuthorComicChapterToUploads(
  payload: LoadComicChapterUploadPayload,
): Promise<AuthorUploadState> {
  const response = await fetch(
    `${API_BASE_URL}/api/author/comic-upload/load-chapter`,
    {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return readJsonOrThrow<AuthorUploadState>(response);
}

export async function publishAuthorComicChapterUpdate(
  payload: PublishComicChapterUpdatePayload,
): Promise<PublishComicChapterResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/author/comic-upload/publish-to-chapter`,
    {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return readJsonOrThrow<PublishComicChapterResult>(response);
}

export async function reorderAuthorUploadImages(
  payload: ReorderUploadImagesPayload,
): Promise<AuthorUploadState> {
  const response = await fetch(
    `${API_BASE_URL}/api/author/comic-upload/images/reorder`,
    {
      method: "PATCH",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return readJsonOrThrow<AuthorUploadState>(response);
}
