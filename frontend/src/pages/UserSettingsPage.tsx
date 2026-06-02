import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe, notifyAuthChanged, type AuthUser } from "../api/auth";
import {
  deleteMyAvatar,
  listMyAvatars,
  resolveAssetUrl,
  switchMyAvatar,
  updateMyProfile,
  uploadMyAvatar,
  type UserAvatarAsset,
} from "../api/userProfile";

type CropState = {
  dataUrl: string;
  fileName: string;
};

type ImageSize = {
  width: number;
  height: number;
};

type Offset = {
  x: number;
  y: number;
};

type PointerRecord = {
  x: number;
  y: number;
};

function getInitial(name: string | null | undefined) {
  const value = (name || "").trim();

  if (!value) {
    return "?";
  }

  return value.slice(0, 1).toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampOffset(
  offset: Offset,
  zoom: number,
  imageSize: ImageSize | null,
  canvasSize: number,
): Offset {
  if (!imageSize) {
    return offset;
  }

  const baseScale = Math.max(
    canvasSize / imageSize.width,
    canvasSize / imageSize.height,
  );
  const scale = baseScale * zoom;
  const drawWidth = imageSize.width * scale;
  const drawHeight = imageSize.height * scale;

  const maxX = Math.max(0, (drawWidth - canvasSize) / 2);
  const maxY = Math.max(0, (drawHeight - canvasSize) / 2);

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

function getPointerDistance(a: PointerRecord, b: PointerRecord) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function AvatarCircle({
  user,
  sizeClass = "h-24 w-24 text-3xl",
  onClick,
}: {
  user: AuthUser;
  sizeClass?: string;
  onClick?: () => void;
}) {
  const avatarUrl = resolveAssetUrl(user.avatarUrl);

  if (avatarUrl) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group relative overflow-hidden rounded-full border border-[var(--color-border-soft)] bg-white/70 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-accent-border-strong)] hover:shadow-md ${sizeClass}`}
        title="更换头像"
      >
        <img
          src={avatarUrl}
          alt={user.displayName}
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-slate-900/30 group-hover:opacity-100">
          更换
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`badge-accent group relative flex items-center justify-center rounded-full font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${sizeClass}`}
      title="上传头像"
    >
      {getInitial(user.displayName)}
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-slate-900/25 group-hover:opacity-100">
        上传
      </span>
    </button>
  );
}

function CropAvatarDialog({
  crop,
  isUploading,
  onCancel,
  onConfirm,
}: {
  crop: CropState;
  isUploading: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageSizeRef = useRef<ImageSize | null>(null);
  const pointersRef = useRef<Map<number, PointerRecord>>(new Map());
  const lastDragPointRef = useRef<PointerRecord | null>(null);
  const pinchStartRef = useRef<{
    distance: number;
    zoom: number;
  } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [isPreparing, setIsPreparing] = useState(false);

  const canvasSize = 512;

  useEffect(() => {
    let cancelled = false;

    async function loadImageSize() {
      const image = new Image();
      image.src = crop.dataUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("图片加载失败"));
      });

      if (cancelled) {
        return;
      }

      imageSizeRef.current = {
        width: image.width,
        height: image.height,
      };

      setOffset({ x: 0, y: 0 });
      setZoom(1);
    }

    loadImageSize().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [crop.dataUrl]);

  useEffect(() => {
    let cancelled = false;

    async function drawPreview() {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const image = new Image();
      image.src = crop.dataUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("图片加载失败"));
      });

      if (cancelled) {
        return;
      }

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      canvas.width = canvasSize;
      canvas.height = canvasSize;

      const safeOffset = clampOffset(
        offset,
        zoom,
        {
          width: image.width,
          height: image.height,
        },
        canvasSize,
      );

      const baseScale = Math.max(canvasSize / image.width, canvasSize / image.height);
      const scale = baseScale * zoom;
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const dx = (canvasSize - drawWidth) / 2 + safeOffset.x;
      const dy = (canvasSize - drawHeight) / 2 + safeOffset.y;

      ctx.clearRect(0, 0, canvasSize, canvasSize);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    }

    drawPreview().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [crop.dataUrl, offset, zoom]);

  function updateZoom(nextZoom: number) {
    const clampedZoom = clamp(nextZoom, 1, 3);

    setZoom(clampedZoom);
    setOffset((current) =>
      clampOffset(current, clampedZoom, imageSizeRef.current, canvasSize),
    );
  }

  function updateOffset(deltaX: number, deltaY: number) {
    setOffset((current) => {
      const next = {
        x: current.x + deltaX,
        y: current.y + deltaY,
      };

      return clampOffset(next, zoom, imageSizeRef.current, canvasSize);
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 1) {
      lastDragPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      pinchStartRef.current = null;
    }

    if (pointersRef.current.size === 2) {
      const pointers = Array.from(pointersRef.current.values());
      pinchStartRef.current = {
        distance: getPointerDistance(pointers[0], pointers[1]),
        zoom,
      };
      lastDragPointRef.current = null;
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 1) {
      const lastPoint = lastDragPointRef.current;

      if (!lastPoint) {
        lastDragPointRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
        return;
      }

      const dx = event.clientX - lastPoint.x;
      const dy = event.clientY - lastPoint.y;

      updateOffset(dx, dy);

      lastDragPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      return;
    }

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pointers = Array.from(pointersRef.current.values());
      const distance = getPointerDistance(pointers[0], pointers[1]);

      if (pinchStartRef.current.distance > 0) {
        const ratio = distance / pinchStartRef.current.distance;
        updateZoom(pinchStartRef.current.zoom * ratio);
      }
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      lastDragPointRef.current = null;
      pinchStartRef.current = null;
      return;
    }

    if (pointersRef.current.size === 1) {
      const pointer = Array.from(pointersRef.current.values())[0];
      lastDragPointRef.current = pointer;
      pinchStartRef.current = null;
    }
  }

  async function handleConfirm() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    setIsPreparing(true);

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", 0.92);
      });

      if (!blob) {
        throw new Error("头像裁剪失败");
      }

      onConfirm(blob);
    } finally {
      setIsPreparing(false);
    }
  }

  const confirmDisabled = isPreparing || isUploading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="surface-card w-full max-w-md p-5 shadow-xl sm:p-6">
        <h2 className="text-lg font-semibold text-main">裁剪头像</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          拖动图片调整位置。桌面端可用滑条缩放，手机端可双指缩放。
        </p>

        <div className="mt-5 flex justify-center">
          <div
            className="relative aspect-square w-full max-w-[18rem] touch-none overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white sm:max-w-[20rem]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            <canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
            <div className="pointer-events-none absolute inset-0 border-2 border-white/80 shadow-[inset_0_0_0_999px_rgba(15,23,42,0.08)]" />
          </div>
        </div>

        <label className="mt-5 hidden text-sm text-muted md:block">
          缩放
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => updateZoom(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>

        <p className="mt-4 text-xs text-soft md:hidden">
          手机上可单指拖动位置，双指缩放大小。
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="admin-button-secondary px-4 py-2 text-sm transition"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="admin-button-primary px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmDisabled ? "处理中..." : "使用头像"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserSettingsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [me, setMe] = useState<AuthUser | null>(null);
  const [avatars, setAvatars] = useState<UserAvatarAsset[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [busyAvatarId, setBusyAvatarId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [crop, setCrop] = useState<CropState | null>(null);

  useEffect(() => {
    if (!errorMessage && !successMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setErrorMessage("");
      setSuccessMessage("");
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [errorMessage, successMessage]);

  const oldAvatars = useMemo(() => {
    return avatars.filter((avatar) => !avatar.isCurrent).slice(0, 5);
  }, [avatars]);

  async function loadData() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [user, avatarList] = await Promise.all([getMe(), listMyAvatars()]);

      setMe(user);
      setDisplayName(user.displayName);
      setBio(user.bio ?? "");
      setAvatars(avatarList);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载设置失败");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("请选择图片文件");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCrop({
          dataUrl: reader.result,
          fileName: file.name,
        });
      }
    };

    reader.onerror = () => {
      setErrorMessage("读取图片失败");
    };

    reader.readAsDataURL(file);
  }

  async function handleUploadCroppedAvatar(blob: Blob) {
    setIsUploading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const user = await uploadMyAvatar(blob);
      setMe(user);
      setDisplayName(user.displayName);
      setBio(user.bio ?? "");
      setCrop(null);
      await loadData();
      notifyAuthChanged();
      setSuccessMessage("头像已更新");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "上传头像失败");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSwitchAvatar(assetId: string) {
    setBusyAvatarId(assetId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const user = await switchMyAvatar(assetId);
      setMe(user);
      await loadData();
      notifyAuthChanged();
      setSuccessMessage("头像已切换");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "切换头像失败");
    } finally {
      setBusyAvatarId(null);
    }
  }

  async function handleClearAvatar() {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const user = await switchMyAvatar(null);
      setMe(user);
      await loadData();
      notifyAuthChanged();
      setSuccessMessage("头像已清空");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "清空头像失败");
    }
  }

  async function handleDeleteAvatar(assetId: string) {
    const confirmed = window.confirm("确定删除这张往期头像吗？删除后文件也会被移除。");

    if (!confirmed) {
      return;
    }

    setBusyAvatarId(assetId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deleteMyAvatar(assetId);
      await loadData();
      setSuccessMessage("头像已删除");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除头像失败");
    } finally {
      setBusyAvatarId(null);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const user = await updateMyProfile({
        displayName,
        bio,
      });

      setMe(user);
      setDisplayName(user.displayName);
      setBio(user.bio ?? "");
      notifyAuthChanged();
      setSuccessMessage("资料已保存");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (me) {
      navigate(`/users/${me.username}`);
      return;
    }

    navigate("/");
  }

  if (isLoading) {
    return (
      <main className="page-shell px-5 py-10 sm:px-6 sm:py-12">
        <section className="mx-auto max-w-5xl">
          <p className="text-sm text-soft">正在加载设置...</p>
        </section>
      </main>
    );
  }

  if (errorMessage && !me) {
    return (
      <main className="page-shell px-5 py-10 sm:px-6 sm:py-12">
        <section className="mx-auto max-w-5xl">
          <Link to="/" className="link-accent text-sm transition">
            ← 返回首页
          </Link>
          <h1 className="mt-8 text-3xl font-semibold text-main">无法打开设置</h1>
          <p className="mt-3 text-sm text-soft">{errorMessage}</p>
        </section>
      </main>
    );
  }

  if (!me) {
    return null;
  }

  const hasAvatar = Boolean(me.avatarUrl);

  return (
    <main className="page-shell px-4 py-8 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-5xl">
        <Link to={`/users/${me.username}`} className="link-accent text-sm transition">
          ← 返回个人页
        </Link>

        <section className="surface-card mt-6 overflow-hidden sm:mt-8">
          <div className="grid min-h-[620px] grid-cols-1 md:grid-cols-[180px_1fr]">
            <aside className="border-b border-[var(--color-border-soft)] p-3 md:border-b-0 md:border-r md:p-4">
              <button
                type="button"
                className="w-full rounded-xl bg-[var(--color-panel-soft-bg)] px-4 py-3 text-left text-sm font-medium text-main"
              >
                我的信息
              </button>
            </aside>

            <section className="p-5 sm:p-6 md:p-8">
              <div>
                <h1 className="text-2xl font-semibold text-main">我的信息</h1>
                <p className="mt-2 text-sm leading-6 text-muted">
                  修改头像、显示名和个人简介。username 用于登录，暂时不能修改。
                </p>
              </div>

              <div className="mt-8">
                <h2 className="text-sm font-medium text-main">当前头像</h2>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <AvatarCircle user={me} onClick={openFilePicker} />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={openFilePicker}
                      disabled={isUploading}
                      className="admin-button-secondary px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUploading ? "正在上传..." : "上传头像"}
                    </button>

                    <button
                      type="button"
                      onClick={handleClearAvatar}
                      disabled={!hasAvatar}
                      className="admin-button-secondary px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      清空头像
                    </button>

                    <p className="basis-full text-xs leading-5 text-soft">
                      点击当前头像或上传按钮选择图片，保存前会先裁剪成固定正方形。
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="mt-8">
                <h2 className="text-sm font-medium text-main">往期头像</h2>

                <div className="admin-muted-panel mt-4 max-w-md p-3 sm:p-4">
                  {oldAvatars.length > 0 ? (
                    <div className="grid grid-cols-5 gap-2">
                      {oldAvatars.map((avatar) => {
                        const imageUrl = resolveAssetUrl(avatar.url);
                        const isBusy = busyAvatarId === avatar.id;

                        return (
                          <div
                            key={avatar.id}
                            className="group relative h-14 w-14 overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-white sm:h-16 sm:w-16"
                          >
                            <button
                              type="button"
                              onClick={() => handleSwitchAvatar(avatar.id)}
                              disabled={isBusy}
                              className="h-full w-full disabled:cursor-not-allowed disabled:opacity-60"
                              title="切换为该头像"
                            >
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={avatar.originalName}
                                  className="h-full w-full object-cover transition group-hover:scale-105"
                                />
                              ) : null}
                              <span className="absolute inset-0 bg-slate-900/0 transition group-hover:bg-slate-900/10" />
                            </button>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteAvatar(avatar.id);
                              }}
                              disabled={isBusy}
                              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-sm leading-none text-[var(--color-danger)] shadow-sm transition hover:bg-[var(--color-danger-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                              title="删除头像"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-soft">还没有可切换的往期头像。</p>
                  )}
                </div>
              </div>

              <div className="mt-10 space-y-5">
                <label className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="w-16 shrink-0 text-sm font-medium text-main">
                    名称：
                  </span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="admin-input w-full px-3 py-2 text-sm sm:max-w-[18rem]"
                  />
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="w-16 shrink-0 text-sm font-medium text-main">
                    username：
                  </span>
                  <span className="text-sm text-soft">
                    {me.username}
                  </span>
                </div>

                <label className="block max-w-2xl">
                  <span className="text-sm font-medium text-main">简介：</span>
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    rows={3}
                    className="admin-textarea mt-2 w-full resize-none px-3 py-3 text-sm leading-6"
                    placeholder="写一点个人简介。"
                  />
                </label>
              </div>

              {(errorMessage || successMessage) && (
                <div
                  className={`mt-6 px-4 py-3 text-sm ${
                    errorMessage ? "message-error" : "message-success"
                  }`}
                >
                  {errorMessage || successMessage}
                </div>
              )}

              <div className="mt-10 flex max-w-2xl flex-col-reverse gap-3 border-t border-[var(--color-border-soft)] pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="admin-button-secondary px-5 py-2 text-sm transition"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="admin-button-primary px-5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "保存中..." : "保存"}
                </button>
              </div>
            </section>
          </div>
        </section>
      </section>

      {crop && (
        <CropAvatarDialog
          crop={crop}
          isUploading={isUploading}
          onCancel={() => setCrop(null)}
          onConfirm={handleUploadCroppedAvatar}
        />
      )}
    </main>
  );
}