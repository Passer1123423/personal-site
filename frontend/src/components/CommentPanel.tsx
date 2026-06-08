import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getAccessToken, getMe, type AuthUser } from "../api/auth";
import {
  createComment,
  deleteOwnComment,
  listCommentTree,
  type CommentItem,
} from "../api/interactions";
import { formatChinaDateTimeToMinute } from "../utils/time";
import { resolveAssetUrl } from "../api/userProfile";

type CommentPanelProps = {
  targetType: string;
  targetId: string;
  title?: string;
  emptyText?: string;
  className?: string;
};

type ReplyTarget = {
  commentId: string;
  parentId: string;
  replyToId: string;
  mentionUsername: string | null;
};

type FlatReply = {
  comment: CommentItem;
  replyToComment: CommentItem | null;
};

type CommentNodeProps = {
  comment: CommentItem;
  currentUser: AuthUser | null;
  deletingId: string;
  replyTarget: ReplyTarget | null;
  replyContent: string;
  onStartReply: (target: ReplyTarget) => void;
  onCancelReply: () => void;
  onChangeReplyContent: (content: string) => void;
  onSubmitReply: () => void;
  onDelete: (commentId: string) => void;
  onPreviewImage: (urls: string[], index: number) => void;
  expandedReplyIds: Set<string>;
  onToggleRepliesExpanded: (commentId: string) => void;
};

type ReplyNodeProps = {
  item: FlatReply;
  rootCommentId: string;
  currentUser: AuthUser | null;
  deletingId: string;
  replyTarget: ReplyTarget | null;
  replyContent: string;
  onStartReply: (target: ReplyTarget) => void;
  onCancelReply: () => void;
  onChangeReplyContent: (content: string) => void;
  onSubmitReply: () => void;
  onDelete: (commentId: string) => void;
};

type AutoResizeTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  maxLength?: number;
  minRows?: number;
  maxRows?: number;
  onFocus?: () => void;
  onBlur?: () => void;
};

type FloatingComposerStyle = {
  left: number;
  width: number;
};

type ComposerDock = "none" | "floating" | "bottom";

type SelectedCommentImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type PreviewImageState = {
  urls: string[];
  index: number;
};

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  maxLength = 1000,
  minRows = 1,
  maxRows = 6,
  onFocus,
  onBlur,
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const borderTop = Number.parseFloat(computedStyle.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(computedStyle.borderBottomWidth) || 0;

    const minHeight =
      lineHeight * minRows + paddingTop + paddingBottom + borderTop + borderBottom;
    const maxHeight =
      lineHeight * maxRows + paddingTop + paddingBottom + borderTop + borderBottom;

    textarea.style.height = "auto";

    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, minRows, maxRows]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      className={[
        "w-full resize-none rounded-xl border border-[var(--color-border-control)]",
        "bg-[var(--color-panel-bg)] px-4 py-2.5 text-sm leading-6 text-main",
        "outline-none placeholder:text-soft focus:border-[var(--color-accent-border-strong)]",
        className,
      ].join(" ")}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={minRows}
    />
  );
}

function getCommentDisplayName(comment: CommentItem) {
  if (!comment.user) {
    return "未知用户";
  }

  return comment.user.display_name || comment.user.username;
}

function getCommentUsername(comment: CommentItem) {
  return comment.user?.username ?? null;
}

function getInitial(comment: CommentItem) {
  const name = getCommentDisplayName(comment);
  return name.slice(0, 1).toUpperCase();
}

function getCommentAvatarUrl(comment: CommentItem) {
  const user = comment.user as
    | {
        avatarUrl?: string | null;
        avatar_url?: string | null;
      }
    | null
    | undefined;

  return resolveAssetUrl(user?.avatarUrl ?? user?.avatar_url ?? null);
}

function getCurrentUserName(user: AuthUser) {
  return user.displayName || user.username;
}

function parseLeadingMention(content: string) {
  const match = content.match(/^@([A-Za-z0-9_.-]+)[：:]\s*/);

  if (!match) {
    return null;
  }

  return {
    username: match[1],
    rest: content.slice(match[0].length),
  };
}

function collectCommentMap(root: CommentItem) {
  const map = new Map<string, CommentItem>();

  function visit(comment: CommentItem) {
    map.set(comment.id, comment);
    comment.children.forEach(visit);
  }

  visit(root);

  return map;
}

function collectReplies(children: CommentItem[]): CommentItem[] {
  const result: CommentItem[] = [];

  children.forEach((child) => {
    result.push(child);
    result.push(...collectReplies(child.children));
  });

  return result;
}

function flattenReplies(rootComment: CommentItem): FlatReply[] {
  const commentMap = collectCommentMap(rootComment);
  const replies = collectReplies(rootComment.children);

  return replies.map((reply) => {
    const replyToId = reply.reply_to_id ?? reply.parent_id;
    const replyToComment = replyToId ? commentMap.get(replyToId) ?? rootComment : rootComment;

    return {
      comment: reply,
      replyToComment,
    };
  });
}

function CommentAvatar({
  comment,
  small = false,
}: {
  comment: CommentItem;
  small?: boolean;
}) {
  const avatarUrl = getCommentAvatarUrl(comment);
  const sizeClass = small ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";

  if (avatarUrl) {
    return (
      <div
        className={[
          "shrink-0 overflow-hidden rounded-full border border-[var(--color-border-soft)] bg-white",
          sizeClass,
        ].join(" ")}
      >
        <img
          src={avatarUrl}
          alt={getCommentDisplayName(comment)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-full",
        "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent)]",
        sizeClass,
      ].join(" ")}
    >
      {getInitial(comment)}
    </div>
  );
}

function CommentContent({ comment }: { comment: CommentItem }) {
  if (comment.is_deleted) {
    return <p className="mt-2 text-sm text-soft">该评论已删除。</p>;
  }

  const mention = parseLeadingMention(comment.content);

  if (mention) {
    return (
      <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-7 text-main">
        <Link to={`/users/${mention.username}`} className="link-accent">
          @{mention.username}
        </Link>
        <span>：{mention.rest}</span>
      </p>
    );
  }

  return (
    <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-7 text-main">
      {comment.content}
    </p>
  );
}

function CommentImages({
  comment,
  onPreviewImage,
}: {
  comment: CommentItem;
  onPreviewImage: (urls: string[], index: number) => void;
}) {
  const images = comment.images ?? [];
  const imageUrls = images.map((image) => resolveAssetUrl(image.url) ?? image.url);

  if (comment.is_deleted || images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    const image = images[0];
    const imageUrl = imageUrls[0];

    return (
      <div className="mt-3">
        <button
          type="button"
          className="block max-w-[320px] cursor-zoom-in overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] transition hover:border-[var(--color-accent-border-strong)] hover:brightness-95"
          onClick={() => onPreviewImage(imageUrls, 0)}
          aria-label="查看评论图片"
        >
          <img
            src={imageUrl}
            alt={image.original_name}
            className="max-h-[360px] w-auto max-w-full object-contain"
            loading="lazy"
          />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 grid max-w-[300px] grid-cols-3 gap-1.5">
      {images.map((image, index) => {
        const imageUrl = imageUrls[index];

        return (
          <button
            key={image.id}
            type="button"
            className="aspect-square cursor-zoom-in overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)] transition hover:border-[var(--color-accent-border-strong)] hover:brightness-95"
            onClick={() => onPreviewImage(imageUrls, index)}
            aria-label="查看评论图片"
          >
            <img
              src={imageUrl}
              alt={image.original_name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        );
      })}
    </div>
  );
}

function ReplyComposer({
  replyContent,
  onCancelReply,
  onChangeReplyContent,
  onSubmitReply,
}: {
  replyContent: string;
  onCancelReply: () => void;
  onChangeReplyContent: (content: string) => void;
  onSubmitReply: () => void;
}) {
  return (
    <div className="mt-3">
      <AutoResizeTextarea
        value={replyContent}
        onChange={onChangeReplyContent}
        placeholder="写下回复..."
        minRows={1}
        maxRows={5}
      />

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-xs text-soft hover:bg-[var(--color-panel-soft-bg)] hover:text-main"
          onClick={onCancelReply}
        >
          取消
        </button>
        <button
          type="button"
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]"
          onClick={onSubmitReply}
        >
          发布
        </button>
      </div>
    </div>
  );
}

function ReplyNode({
  item,
  rootCommentId,
  currentUser,
  deletingId,
  replyTarget,
  replyContent,
  onStartReply,
  onCancelReply,
  onChangeReplyContent,
  onSubmitReply,
  onDelete,
}: ReplyNodeProps) {
  const { comment, replyToComment } = item;
  const commentUsername = getCommentUsername(comment);
  const shouldShowReplyTarget = replyToComment
    ? replyToComment.id !== rootCommentId
    : false;

  const canDelete = Boolean(
    currentUser && currentUser.id === comment.user_id && !comment.is_deleted,
  );
  const isReplying = replyTarget?.commentId === comment.id;

  const replyToText = replyToComment
    ? replyToComment.is_deleted
      ? "该评论已删除。"
      : replyToComment.content
    : "";

  return (
    <article className="group relative pt-3">
      {shouldShowReplyTarget && (
        <div className="pointer-events-none absolute left-11 top-2 z-20 hidden max-w-[min(420px,80vw)] rounded-lg border border-[var(--color-border-soft)] bg-white/95 px-3 py-2 text-xs text-muted shadow-lg backdrop-blur group-hover:block">
          <div className="truncate">
            回复：{replyToText}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {commentUsername ? (
          <Link to={`/users/${commentUsername}`}>
            <CommentAvatar comment={comment} small />
          </Link>
        ) : (
          <CommentAvatar comment={comment} small />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {commentUsername ? (
              <Link to={`/users/${commentUsername}`}>
                <span className="text-sm font-medium text-[var(--color-text-muted)] hover:underline hover:underline-offset-4">
                  {getCommentDisplayName(comment)}
                </span>
              </Link>
            ) : (
              <span className="text-sm font-medium text-[var(--color-text-muted)] hover:underline hover:underline-offset-4">
                {getCommentDisplayName(comment)}
              </span>
            )}

            {comment.user?.role === "admin" && (
              <span className="rounded px-1.5 py-0.5 text-[10px] leading-none text-[var(--color-accent)] ring-1 ring-[var(--color-accent-border)]">
                UP
              </span>
            )}
          </div>

          <CommentContent comment={comment} />

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-soft">
            <span>{formatChinaDateTimeToMinute(comment.created_at)}</span>

            {!comment.is_deleted && currentUser && (
              <button
                type="button"
                className="hover:text-[var(--color-accent)]"
                onClick={() =>
                  onStartReply({
                    commentId: comment.id,
                    parentId: rootCommentId,
                    replyToId: comment.id,
                    mentionUsername: comment.user?.username ?? null,
                  })
                }
              >
                回复
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                className="hover:text-[var(--color-danger)] disabled:opacity-60"
                disabled={deletingId === comment.id}
                onClick={() => onDelete(comment.id)}
              >
                {deletingId === comment.id ? "删除中..." : "删除"}
              </button>
            )}
          </div>

          {isReplying && (
            <ReplyComposer
              replyContent={replyContent}
              onCancelReply={onCancelReply}
              onChangeReplyContent={onChangeReplyContent}
              onSubmitReply={onSubmitReply}
            />
          )}
        </div>
      </div>
    </article>
  );
}

function CommentNode({
  comment,
  currentUser,
  deletingId,
  replyTarget,
  replyContent,
  onStartReply,
  onCancelReply,
  onChangeReplyContent,
  onSubmitReply,
  onDelete,
  onPreviewImage,
  expandedReplyIds,
  onToggleRepliesExpanded,
}: CommentNodeProps) {
  const commentUsername = getCommentUsername(comment);
  const canDelete = Boolean(
    currentUser && currentUser.id === comment.user_id && !comment.is_deleted,
  );
  const isReplying = replyTarget?.commentId === comment.id;
  const replies = flattenReplies(comment);

  const shouldCollapseReplies = replies.length > 3;
  const repliesCollapsed =
    shouldCollapseReplies && !expandedReplyIds.has(comment.id);
  const visibleReplies = shouldCollapseReplies && repliesCollapsed ? [] : replies;

  return (
    <article className="border-b border-[var(--color-border-soft)] py-5 last:border-b-0">
      <div className="flex gap-3">
        {commentUsername ? (
          <Link to={`/users/${commentUsername}`}>
            <CommentAvatar comment={comment} />
          </Link>
        ) : (
          <CommentAvatar comment={comment} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {commentUsername ? (
              <Link to={`/users/${commentUsername}`}>
                <span className="text-sm font-medium text-[var(--color-text-muted)] hover:underline hover:underline-offset-4">
                  {getCommentDisplayName(comment)}
                </span>
              </Link>
            ) : (
              <span className="text-sm font-medium text-[var(--color-text-muted)] hover:underline hover:underline-offset-4">
                {getCommentDisplayName(comment)}
              </span>
            )}

            {comment.user?.role === "admin" && (
              <span className="rounded px-1.5 py-0.5 text-[10px] leading-none text-[var(--color-accent)] ring-1 ring-[var(--color-accent-border)]">
                UP
              </span>
            )}
          </div>

          <CommentContent comment={comment} />

          <CommentImages comment={comment} onPreviewImage={onPreviewImage} />

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-soft">
            <span>{formatChinaDateTimeToMinute(comment.created_at)}</span>

            {!comment.is_deleted && currentUser && (
              <button
                type="button"
                className="hover:text-[var(--color-accent)]"
                onClick={() =>
                  onStartReply({
                    commentId: comment.id,
                    parentId: comment.id,
                    replyToId: comment.id,
                    mentionUsername: null,
                  })
                }
              >
                回复
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                className="hover:text-[var(--color-danger)] disabled:opacity-60"
                disabled={deletingId === comment.id}
                onClick={() => onDelete(comment.id)}
              >
                {deletingId === comment.id ? "删除中..." : "删除"}
              </button>
            )}
          </div>

          {isReplying && (
            <ReplyComposer
              replyContent={replyContent}
              onCancelReply={onCancelReply}
              onChangeReplyContent={onChangeReplyContent}
              onSubmitReply={onSubmitReply}
            />
          )}

          {replies.length > 0 && (
            <div className="mt-3 space-y-1">
              {shouldCollapseReplies && (
                <button
                  type="button"
                  className="text-xs text-soft hover:!text-[var(--color-accent)] hover:underline hover:underline-offset-4"
                  onClick={() => onToggleRepliesExpanded(comment.id)}
                >
                  {repliesCollapsed ? `展开 ${replies.length} 条回复` : "收起回复"}
                </button>
              )}

              {visibleReplies.map((item) => (
                <ReplyNode
                  key={item.comment.id}
                  item={item}
                  rootCommentId={comment.id}
                  currentUser={currentUser}
                  deletingId={deletingId}
                  replyTarget={replyTarget}
                  replyContent={replyContent}
                  onStartReply={onStartReply}
                  onCancelReply={onCancelReply}
                  onChangeReplyContent={onChangeReplyContent}
                  onSubmitReply={onSubmitReply}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CommentPanel({
  targetType,
  targetId,
  title = "评论",
  emptyText = "还没有评论。",
  className = "",
}: CommentPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedCommentImage[]>([]);
  const [isComposerActive, setIsComposerActive] = useState(false);
  const [previewImageState, setPreviewImageState] = useState<PreviewImageState | null>(null);

  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [expandedReplyIds, setExpandedReplyIds] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [composerDock, setComposerDock] = useState<ComposerDock>("none");
  const [floatingComposerStyle, setFloatingComposerStyle] =
    useState<FloatingComposerStyle>({
      left: 0,
      width: 0,
    });

  const panelRef = useRef<HTMLElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const selectedImagePreviewUrlsRef = useRef<string[]>([]);
  const isPickingImagesRef = useRef(false);

  const commentCount = useMemo(() => {
    function count(nodes: CommentItem[]): number {
      return nodes.reduce((total, node) => total + 1 + count(node.children), 0);
    }

    return count(comments);
  }, [comments]);

  const canSubmit = useMemo(() => {
    return content.trim().length > 0 && !isSubmitting;
  }, [content, isSubmitting]);

  const hasComposerDraft = useMemo(() => {
    return content.trim().length > 0 || selectedImages.length > 0;
  }, [content, selectedImages.length]);

  const shouldShowComposerActions = isComposerActive || hasComposerDraft;

  const currentUserAvatarUrl = resolveAssetUrl(currentUser?.avatarUrl);

  function showError(message: string) {
    setErrorMessage(message);
  }

  function clearSelectedImages() {
    selectedImagePreviewUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    selectedImagePreviewUrlsRef.current = [];
    setSelectedImages([]);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function handleSelectImages(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    const incomingFiles = Array.from(files);

    if (selectedImages.length + incomingFiles.length > 9) {
      showError("一条评论最多上传 9 张图片");

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      return;
    }

    const nextImages: SelectedCommentImage[] = [];

    for (const file of incomingFiles) {
      if (!file.type.startsWith("image/")) {
        showError("只能选择图片文件");
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      selectedImagePreviewUrlsRef.current.push(previewUrl);

      const imageId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      nextImages.push({
        id: `${file.name}-${file.lastModified}-${imageId}`,
        file,
        previewUrl,
      });
    }

    if (nextImages.length > 0) {
      setSelectedImages((prev) => [...prev, ...nextImages]);
      setIsComposerActive(true);
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function handleRemoveSelectedImage(imageId: string) {
    setSelectedImages((prev) => {
      const target = prev.find((image) => image.id === imageId);

      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        selectedImagePreviewUrlsRef.current =
          selectedImagePreviewUrlsRef.current.filter((url) => url !== target.previewUrl);
      }

      return prev.filter((image) => image.id !== imageId);
    });
  }

  function showPreviousPreviewImage() {
    setPreviewImageState((prev) => {
      if (!prev || prev.urls.length <= 1) {
        return prev;
      }

      return {
        urls: prev.urls,
        index: (prev.index - 1 + prev.urls.length) % prev.urls.length,
      };
    });
  }

  function showNextPreviewImage() {
    setPreviewImageState((prev) => {
      if (!prev || prev.urls.length <= 1) {
        return prev;
      }

      return {
        urls: prev.urls,
        index: (prev.index + 1) % prev.urls.length,
      };
    });
  }

  async function loadComments(options: { silent?: boolean } = {}) {
    if (!targetType || !targetId) {
      setComments([]);
      setIsLoading(false);
      return;
    }

    if (!options.silent) {
      setIsLoading(true);
    }
    setErrorMessage("");

    try {
      const data = await listCommentTree({
        targetType,
        targetId,
        limit: 100,
      });
      setComments(data);
    } catch (error) {
      showError(error instanceof Error ? error.message : "加载评论失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCurrentUser() {
    if (!getAccessToken()) {
      setCurrentUser(null);
      return;
    }

    try {
      const user = await getMe();
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    }
  }

  useEffect(() => {
    loadComments();
  }, [targetType, targetId]);

  useEffect(() => {
    loadCurrentUser();

    function handleAuthChanged() {
      loadCurrentUser();
    }

    window.addEventListener("auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChanged);
    };
  }, []);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setErrorMessage("");
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [errorMessage]);

  useEffect(() => {
    function updateComposerDock() {
      const panel = panelRef.current;
      const composer = composerRef.current;
      const bottomAnchor = bottomAnchorRef.current;

      if (!panel || !composer || !bottomAnchor) {
        setComposerDock("none");
        return;
      }

      const panelRect = panel.getBoundingClientRect();
      const composerRect = composer.getBoundingClientRect();
      const bottomAnchorRect = bottomAnchor.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const composerFullyAboveViewport = composerRect.bottom <= 0;
      const panelHasEnteredViewport = panelRect.top < viewportHeight;
      const bottomAreaHasReachedViewport = bottomAnchorRect.top <= viewportHeight - 8;

      if (!composerFullyAboveViewport || !panelHasEnteredViewport) {
        setComposerDock("none");
        return;
      }

      if (bottomAreaHasReachedViewport) {
        setComposerDock("bottom");
        return;
      }

      setComposerDock("floating");
      setFloatingComposerStyle({
        left: panelRect.left,
        width: panelRect.width,
      });
    }

    updateComposerDock();

    window.addEventListener("scroll", updateComposerDock, { passive: true });
    window.addEventListener("resize", updateComposerDock);

    return () => {
      window.removeEventListener("scroll", updateComposerDock);
      window.removeEventListener("resize", updateComposerDock);
    };
  }, [comments.length, content, selectedImages.length, shouldShowComposerActions, isLoading]);

  useEffect(() => {
    if (!previewImageState) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [previewImageState]);

  useEffect(() => {
    return () => {
      selectedImagePreviewUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      selectedImagePreviewUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!previewImageState) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImageState(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        showPreviousPreviewImage();
        return;
      }

      if (event.key === "ArrowRight") {
        showNextPreviewImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImageState]);

  function toggleRepliesExpanded(commentId: string) {
    setExpandedReplyIds((prev) => {
      const next = new Set(prev);

      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }

      return next;
    });
  }

  async function handleSubmit() {
    const cleanContent = content.trim();

    if (!cleanContent) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createComment({
        targetType,
        targetId,
        content: cleanContent,
        images: selectedImages.map((image) => image.file),
      });

      setContent("");
      clearSelectedImages();
      setIsComposerActive(false);
      await loadComments({ silent: true });
    } catch (error) {
      showError(error instanceof Error ? error.message : "发表评论失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitReply() {
    const cleanContent = replyContent.trim();

    if (!cleanContent || !replyTarget) {
      return;
    }

    const finalContent = replyTarget.mentionUsername
      ? `@${replyTarget.mentionUsername}：${cleanContent}`
      : cleanContent;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createComment({
        targetType,
        targetId,
        content: finalContent,
        parentId: replyTarget.parentId,
        replyToId: replyTarget.replyToId,
      });

      setReplyTarget(null);
      setReplyContent("");
      await loadComments({ silent: true });
    } catch (error) {
      showError(error instanceof Error ? error.message : "发布回复失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    const confirmed = window.confirm("确定删除这条评论吗？删除后前台将不再显示原文。");

    if (!confirmed) {
      return;
    }

    setDeletingId(commentId);
    setErrorMessage("");

    try {
      await deleteOwnComment(commentId);
      await loadComments({ silent: true });
    } catch (error) {
      showError(error instanceof Error ? error.message : "删除评论失败");
    } finally {
      setDeletingId("");
    }
  }

  function renderComposer(mode: "top" | "floating" | "bottom" = "top") {
    const isFloating = mode === "floating";

    const shellClass =
      mode === "top"
        ? ""
        : [
            "border-t border-[var(--color-border-soft)]",
            "bg-[var(--color-panel-bg)] py-3",
          ].join(" ");

    return (
      <div
        className={
          isFloating
            ? ["fixed bottom-0 z-40", shellClass].join(" ")
            : shellClass
        }
        style={
          isFloating
            ? {
                left: floatingComposerStyle.left,
                width: floatingComposerStyle.width,
              }
            : undefined
        }
      >
        {currentUser ? (
          <div className="flex gap-3">
            {currentUserAvatarUrl ? (
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--color-border-soft)] bg-white">
                <img
                  src={currentUserAvatarUrl}
                  alt={getCurrentUserName(currentUser)}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent)]">
                {getCurrentUserName(currentUser).slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div
                className={[
                  "rounded-xl border transition",
                  shouldShowComposerActions
                    ? [
                        "border-[var(--color-border-control)]",
                        "bg-[var(--color-panel-bg)]",
                        "focus-within:border-[var(--color-accent-border-strong)]",
                      ].join(" ")
                    : "border-transparent bg-[var(--color-panel-soft-bg)]",
                ].join(" ")}
              >
                <AutoResizeTextarea
                  value={content}
                  onChange={(nextContent) => {
                    setContent(nextContent);

                    if (nextContent.trim().length > 0) {
                      setIsComposerActive(true);
                    }
                  }}
                  onFocus={() => setIsComposerActive(true)}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (isPickingImagesRef.current) {
                        return;
                      }

                      if (content.trim().length === 0 && selectedImages.length === 0) {
                        setIsComposerActive(false);
                      }
                    }, 0);
                  }}
                  placeholder="这里需要一条AI率100%的评论"
                  minRows={1}
                  maxRows={6}
                  className="border-0 bg-transparent shadow-none outline-none focus:border-0 focus:outline-none focus:ring-0"
                />

                {selectedImages.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 px-3 pb-3 sm:grid-cols-9">
                    {selectedImages.map((image) => (
                      <div
                        key={image.id}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)]"
                      >
                        <img
                          src={image.previewUrl}
                          alt={image.file.name}
                          className="h-full w-full object-cover"
                        />

                        <button
                          type="button"
                          className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded border border-black/10 bg-white/85 text-[13px] leading-none text-black/55 shadow-sm hover:bg-white hover:text-black/75"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleRemoveSelectedImage(image.id)}
                          aria-label="移除图片"
                        >
                          <span className="-translate-y-px leading-none">×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {shouldShowComposerActions && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="inline-flex h-5 w-8 items-center justify-center rounded border border-[var(--color-border-soft)] bg-[var(--color-panel-bg)] text-[13px] leading-none text-soft hover:border-[var(--color-accent-border-strong)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={selectedImages.length >= 9 || isSubmitting}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        isPickingImagesRef.current = true;
                        setIsComposerActive(true);
                        imageInputRef.current?.click();

                        window.setTimeout(() => {
                          isPickingImagesRef.current = false;
                        }, 800);
                      }}
                      aria-label="添加图片"
                      title="添加图片"
                    >
                      <span className="-translate-y-px leading-none">+</span>
                    </button>

                    <span className="text-xs text-soft">{content.length}/1000</span>
                  </div>

                  <button
                    type="button"
                    className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? "发布中..." : "发布"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[var(--color-panel-soft-bg)] px-4 py-3 text-sm text-muted">
            登录后可以发表评论。
            <Link to="/admin/login" className="ml-2 link-accent">
              去登录
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      ref={panelRef}
      className={["relative", className].filter(Boolean).join(" ")}
    >

    <input
      ref={imageInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      multiple
      className="hidden"
      onChange={(event) => {
        handleSelectImages(event.target.files);
        isPickingImagesRef.current = false;
      }}
    />

      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="mt-1 text-lg font-bold text-main md:mt-2 md:text-xl">
            {title}
          </h2>
          <span className="text-sm text-soft">{commentCount}</span>
        </div>

        <button
          type="button"
          className="text-sm text-soft hover:text-[var(--color-accent)]"
          onClick={() => loadComments()}
        >
          刷新
        </button>
      </div>

      {errorMessage && (
        <div className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl border border-[var(--color-border-soft)] bg-white/95 px-4 py-2 text-sm text-[var(--color-danger)] shadow-lg backdrop-blur">
          {errorMessage}
        </div>
      )}

      <div ref={composerRef} className="mt-5">
        {renderComposer("top")}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="py-6 text-sm text-soft">正在加载评论...</p>
        ) : comments.length === 0 ? (
          <p className="py-6 text-sm text-soft">{emptyText}</p>
        ) : (
          <div>
            {comments.map((comment) => (
              <CommentNode
                key={comment.id}
                comment={comment}
                currentUser={currentUser}
                deletingId={deletingId}
                replyTarget={replyTarget}
                replyContent={replyContent}
                onPreviewImage={(urls, index) => {
                  setPreviewImageState({ urls, index });
                }}
                onStartReply={(target) => {
                  setReplyTarget(target);
                  setReplyContent("");
                }}
                onCancelReply={() => {
                  setReplyTarget(null);
                  setReplyContent("");
                }}
                onChangeReplyContent={setReplyContent}
                onSubmitReply={handleSubmitReply}
                onDelete={handleDelete}
                expandedReplyIds={expandedReplyIds}
                onToggleRepliesExpanded={toggleRepliesExpanded}
              />
            ))}
          </div>
        )}
      </div>

      <div ref={bottomAnchorRef} />

      {composerDock === "bottom" && (
        <div>
          {renderComposer("bottom")}
        </div>
      )}

      {composerDock === "floating" && renderComposer("floating")}

      {previewImageState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImageState(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded border border-white/20 bg-black/30 text-xl leading-none text-white/80 hover:bg-black/50 hover:text-white"
            onClick={() => setPreviewImageState(null)}
            aria-label="关闭图片预览"
          >
            <span className="-translate-y-px leading-none">×</span>
          </button>

          {previewImageState.urls.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/80 transition hover:border-[var(--color-accent-border-strong)] hover:bg-black/50 hover:text-[var(--color-accent)] sm:left-4 sm:h-10 sm:w-10"
                onClick={(event) => {
                  event.stopPropagation();
                  showPreviousPreviewImage();
                }}
                aria-label="上一张图片"
              >
                <span className="-translate-y-px text-2xl leading-none">‹</span>
              </button>

              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/80 transition hover:border-[var(--color-accent-border-strong)] hover:bg-black/50 hover:text-[var(--color-accent)] sm:right-4 sm:h-10 sm:w-10"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextPreviewImage();
                }}
                aria-label="下一张图片"
              >
                <span className="-translate-y-px text-2xl leading-none">›</span>
              </button>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-xs text-white/80">
                {previewImageState.index + 1}/{previewImageState.urls.length}
              </div>
            </>
          )}

          <img
            src={previewImageState.urls[previewImageState.index]}
            alt="评论图片预览"
            className="max-h-full max-w-full cursor-default rounded-xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

    </section>
  );
}
