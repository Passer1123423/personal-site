import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getAccessToken, getMe, type AuthUser } from "../api/auth";
import {
  createComment,
  deleteOwnComment,
  listCommentTree,
  type CommentItem,
} from "../api/interactions";

type CommentPanelProps = {
  targetType: string;
  targetId: string;
  title?: string;
  emptyText?: string;
  className?: string;
};

type CommentNodeProps = {
  comment: CommentItem;
  currentUser: AuthUser | null;
  deletingId: string;
  replyingToId: string | null;
  replyContent: string;
  depth?: number;
  onStartReply: (commentId: string) => void;
  onCancelReply: () => void;
  onChangeReplyContent: (content: string) => void;
  onSubmitReply: (parentId: string) => void;
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
};

type FloatingComposerStyle = {
  left: number;
  width: number;
};

type ComposerDock = "none" | "floating" | "bottom";

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  maxLength = 1000,
  minRows = 1,
  maxRows = 6,
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

function formatCommentTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getCommentUserName(comment: CommentItem) {
  if (!comment.user) {
    return "未知用户";
  }

  return comment.user.display_name || comment.user.username;
}

function getInitial(comment: CommentItem) {
  const name = getCommentUserName(comment);
  return name.slice(0, 1).toUpperCase();
}

function getCurrentUserName(user: AuthUser) {
  return user.displayName || user.username;
}

function CommentAvatar({
  comment,
  small = false,
}: {
  comment: CommentItem;
  small?: boolean;
}) {
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-full",
        "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent)]",
        small ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm",
      ].join(" ")}
    >
      {getInitial(comment)}
    </div>
  );
}

function CommentNode({
  comment,
  currentUser,
  deletingId,
  replyingToId,
  replyContent,
  depth = 0,
  onStartReply,
  onCancelReply,
  onChangeReplyContent,
  onSubmitReply,
  onDelete,
}: CommentNodeProps) {
  const canDelete = Boolean(
    currentUser && currentUser.id === comment.user_id && !comment.is_deleted,
  );
  const isReplying = replyingToId === comment.id;
  const isChild = depth > 0;

  return (
    <article
      className={
        isChild
          ? "pt-3"
          : "border-b border-[var(--color-border-soft)] py-5 last:border-b-0"
      }
    >
      <div className="flex gap-3">
        <CommentAvatar comment={comment} small={isChild} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-[var(--color-text-muted)]">
              {getCommentUserName(comment)}
            </span>

            {comment.user?.role === "admin" && (
              <span className="rounded px-1.5 py-0.5 text-[10px] leading-none text-[var(--color-accent)] ring-1 ring-[var(--color-accent-border)]">
                UP
              </span>
            )}
          </div>

          {comment.is_deleted ? (
            <p className="mt-2 text-sm text-soft">该评论已删除。</p>
          ) : (
            <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-7 text-main">
              {comment.content}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-soft">
            <span>{formatCommentTime(comment.created_at)}</span>

            {!comment.is_deleted && currentUser && (
              <button
                type="button"
                className="hover:text-[var(--color-accent)]"
                onClick={() => onStartReply(comment.id)}
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
                  onClick={() => onSubmitReply(comment.id)}
                >
                  发布
                </button>
              </div>
            </div>
          )}

          {comment.children.length > 0 && (
            <div className="mt-3 space-y-1">
              {comment.children.map((child) => (
                <CommentNode
                  key={child.id}
                  comment={child}
                  currentUser={currentUser}
                  deletingId={deletingId}
                  replyingToId={replyingToId}
                  replyContent={replyContent}
                  depth={depth + 1}
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
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
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

  const commentCount = useMemo(() => {
    function count(nodes: CommentItem[]): number {
      return nodes.reduce((total, node) => total + 1 + count(node.children), 0);
    }

    return count(comments);
  }, [comments]);

  const canSubmit = useMemo(() => {
    return content.trim().length > 0 && !isSubmitting;
  }, [content, isSubmitting]);

  function showError(message: string) {
    setErrorMessage(message);
  }

  async function loadComments() {
    if (!targetType || !targetId) {
      setComments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
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
  }, [comments.length, content, isLoading]);

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
      });

      setContent("");
      await loadComments();
    } catch (error) {
      showError(error instanceof Error ? error.message : "发表评论失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitReply(parentId: string) {
    const cleanContent = replyContent.trim();

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
        parentId,
      });

      setReplyingToId(null);
      setReplyContent("");
      await loadComments();
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
      await loadComments();
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent)]">
              {getCurrentUserName(currentUser).slice(0, 1).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <AutoResizeTextarea
                value={content}
                onChange={setContent}
                placeholder="这里需要一条查重率0%的评论"
                minRows={1}
                maxRows={6}
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-soft">{content.length}/1000</span>

                <button
                  type="button"
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? "发布中..." : "发布"}
                </button>
              </div>
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
          onClick={loadComments}
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
                replyingToId={replyingToId}
                replyContent={replyContent}
                onStartReply={(commentId) => {
                  setReplyingToId(commentId);
                  setReplyContent("");
                }}
                onCancelReply={() => {
                  setReplyingToId(null);
                  setReplyContent("");
                }}
                onChangeReplyContent={setReplyContent}
                onSubmitReply={handleSubmitReply}
                onDelete={handleDelete}
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
    </section>
  );
}