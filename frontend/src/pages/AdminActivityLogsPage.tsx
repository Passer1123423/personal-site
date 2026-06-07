import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { clearAccessToken, getMe } from "../api/auth";
import {
  adminListActivityLogs,
  type AdminActivityLogItem,
} from "../api/adminActivityLogs";
import { fetchAdminUsers, type AdminUser } from "../api/adminUsers";
import {
  fetchAdminComicsTree,
  type AdminComicSeries,
} from "../api/adminComics";
import {
  fetchAdminNovelsTree,
  type AdminNovel,
} from "../api/adminNovels";
import SearchablePicker, {
  type SearchablePickerOption,
} from "../components/SearchablePicker";
import { formatChinaDateTimeToMinute } from "../utils/time";

type SortMode = "newest" | "oldest";
type QuickRange = "all" | "24h" | "7d";
type TargetPickerMode = "picker" | "input" | "disabled";

const PAGE_SIZE = 40;

const CATEGORY_OPTIONS: SearchablePickerOption[] = [
  {
    value: "auth",
    label: "登录注册",
    badge: "auth",
    searchText: "auth 登录 注册 login register",
  },
  {
    value: "user",
    label: "用户",
    badge: "user",
    searchText: "user 用户 资料 头像 角色",
  },
  {
    value: "comment",
    label: "评论",
    badge: "comment",
    searchText: "comment 评论 回复 删除",
  },
  {
    value: "comment_image",
    label: "评论图片",
    badge: "image",
    searchText: "comment_image 评论图片 图片 上传",
  },
  {
    value: "comic",
    label: "漫画",
    badge: "comic",
    searchText: "comic 漫画 series part chapter",
  },
  {
    value: "comic_upload",
    label: "漫画待传区",
    badge: "upload",
    searchText: "comic_upload 漫画 上传 待传区 staging publish",
  },
  {
    value: "novel",
    label: "小说",
    badge: "novel",
    searchText: "novel 小说 chapter",
  },
  {
    value: "novel_buffer",
    label: "小说缓冲区",
    badge: "buffer",
    searchText: "novel_buffer 小说 buffer 缓冲区 publish",
  },
  {
    value: "asset",
    label: "资源文件",
    badge: "asset",
    searchText: "asset 资源 文件 图片 上传 删除",
  },
  {
    value: "system",
    label: "系统",
    badge: "system",
    searchText: "system 系统 设置 备份 恢复",
  },
];

const ACTION_OPTIONS: SearchablePickerOption[] = [
  {
    value: "auth.register.success",
    label: "用户注册成功",
    description: "auth.register.success",
    badge: "auth",
    searchText: "auth.register.success 注册 register success",
  },
  {
    value: "auth.login.success",
    label: "登录成功",
    description: "auth.login.success",
    badge: "auth",
    searchText: "auth.login.success 登录 login success",
  },
  {
    value: "auth.login.failed",
    label: "登录失败",
    description: "auth.login.failed",
    badge: "auth",
    searchText: "auth.login.failed 登录 login failed",
  },
  {
    value: "comment.create",
    label: "发表评论",
    description: "comment.create",
    badge: "评论",
    searchText: "comment.create 评论 创建 发表 create",
  },
  {
    value: "comment.reply",
    label: "回复评论",
    description: "comment.reply",
    badge: "评论",
    searchText: "comment.reply 回复 评论",
  },
  {
    value: "comment.delete.self",
    label: "用户删除自己的评论",
    description: "comment.delete.self",
    badge: "评论",
    searchText: "comment.delete.self 用户 删除 自己 评论",
  },
  {
    value: "comment.delete.admin_soft",
    label: "管理员软删除评论",
    description: "comment.delete.admin_soft",
    badge: "评论",
    searchText: "comment.delete.admin_soft 管理员 软删除 评论",
  },
  {
    value: "comment.delete.admin_hard",
    label: "管理员硬删除评论",
    description: "comment.delete.admin_hard",
    badge: "评论",
    searchText: "comment.delete.admin_hard 管理员 硬删除 评论",
  },
  {
    value: "comment_image.upload",
    label: "上传评论图片",
    description: "comment_image.upload",
    badge: "图片",
    searchText: "comment_image.upload 评论 图片 上传",
  },
  {
    value: "user.profile.update",
    label: "修改用户资料",
    description: "user.profile.update",
    badge: "用户",
    searchText: "user.profile.update 用户 资料 修改",
  },
  {
    value: "user.avatar.upload",
    label: "上传头像",
    description: "user.avatar.upload",
    badge: "用户",
    searchText: "user.avatar.upload 用户 头像 上传",
  },
  {
    value: "user.avatar.switch",
    label: "切换头像",
    description: "user.avatar.switch",
    badge: "用户",
    searchText: "user.avatar.switch 用户 头像 切换",
  },
  {
    value: "user.avatar.delete",
    label: "删除头像",
    description: "user.avatar.delete",
    badge: "用户",
    searchText: "user.avatar.delete 用户 头像 删除",
  },
  {
    value: "user.role.update",
    label: "修改用户角色",
    description: "user.role.update",
    badge: "用户",
    searchText: "user.role.update 用户 角色 修改",
  },
  {
    value: "comic.series.create",
    label: "创建漫画系列",
    description: "comic.series.create",
    badge: "漫画",
    searchText: "comic.series.create 漫画 系列 创建",
  },
  {
    value: "comic.series.rename",
    label: "重命名漫画系列",
    description: "comic.series.rename",
    badge: "漫画",
    searchText: "comic.series.rename 漫画 系列 重命名",
  },
  {
    value: "comic.series.delete",
    label: "删除漫画系列",
    description: "comic.series.delete",
    badge: "漫画",
    searchText: "comic.series.delete 漫画 系列 删除",
  },
  {
    value: "comic.part.create",
    label: "创建漫画 Part",
    description: "comic.part.create",
    badge: "漫画",
    searchText: "comic.part.create 漫画 part 创建",
  },
  {
    value: "comic.part.rename",
    label: "重命名漫画 Part",
    description: "comic.part.rename",
    badge: "漫画",
    searchText: "comic.part.rename 漫画 part 重命名",
  },
  {
    value: "comic.part.delete",
    label: "删除漫画 Part",
    description: "comic.part.delete",
    badge: "漫画",
    searchText: "comic.part.delete 漫画 part 删除",
  },
  {
    value: "comic.chapter.create",
    label: "创建漫画章节",
    description: "comic.chapter.create",
    badge: "漫画",
    searchText: "comic.chapter.create 漫画 章节 创建",
  },
  {
    value: "comic.chapter.rename",
    label: "重命名漫画章节",
    description: "comic.chapter.rename",
    badge: "漫画",
    searchText: "comic.chapter.rename 漫画 章节 重命名",
  },
  {
    value: "comic.chapter.move",
    label: "移动漫画章节",
    description: "comic.chapter.move",
    badge: "漫画",
    searchText: "comic.chapter.move 漫画 章节 移动 排序",
  },
  {
    value: "comic.chapter.delete",
    label: "删除漫画章节",
    description: "comic.chapter.delete",
    badge: "漫画",
    searchText: "comic.chapter.delete 漫画 章节 删除",
  },
  {
    value: "comic_upload.image.upload",
    label: "上传待传区图片",
    description: "comic_upload.image.upload",
    badge: "上传",
    searchText: "comic_upload.image.upload 漫画 待传区 图片 上传",
  },
  {
    value: "comic_upload.image.delete",
    label: "删除待传区图片",
    description: "comic_upload.image.delete",
    badge: "上传",
    searchText: "comic_upload.image.delete 漫画 待传区 图片 删除",
  },
  {
    value: "comic_upload.image.clear",
    label: "清空待传区",
    description: "comic_upload.image.clear",
    badge: "上传",
    searchText: "comic_upload.image.clear 漫画 待传区 清空",
  },
  {
    value: "comic_upload.chapter.publish",
    label: "发布待传区章节",
    description: "comic_upload.chapter.publish",
    badge: "上传",
    searchText: "comic_upload.chapter.publish 漫画 待传区 发布 章节",
  },
  {
    value: "novel.create",
    label: "创建小说",
    description: "novel.create",
    badge: "小说",
    searchText: "novel.create 小说 创建",
  },
  {
    value: "novel.rename",
    label: "重命名小说",
    description: "novel.rename",
    badge: "小说",
    searchText: "novel.rename 小说 重命名",
  },
  {
    value: "novel.delete",
    label: "删除小说",
    description: "novel.delete",
    badge: "小说",
    searchText: "novel.delete 小说 删除",
  },
  {
    value: "novel.chapter.create",
    label: "创建小说章节",
    description: "novel.chapter.create",
    badge: "小说",
    searchText: "novel.chapter.create 小说 章节 创建",
  },
  {
    value: "novel.chapter.rename",
    label: "重命名小说章节",
    description: "novel.chapter.rename",
    badge: "小说",
    searchText: "novel.chapter.rename 小说 章节 重命名",
  },
  {
    value: "novel.chapter.update_content",
    label: "修改小说章节正文",
    description: "novel.chapter.update_content",
    badge: "小说",
    searchText: "novel.chapter.update_content 小说 章节 正文 修改",
  },
  {
    value: "novel.chapter.move",
    label: "移动小说章节",
    description: "novel.chapter.move",
    badge: "小说",
    searchText: "novel.chapter.move 小说 章节 移动 排序",
  },
  {
    value: "novel.chapter.delete",
    label: "删除小说章节",
    description: "novel.chapter.delete",
    badge: "小说",
    searchText: "novel.chapter.delete 小说 章节 删除",
  },
  {
    value: "novel.buffer.save",
    label: "保存小说缓冲区",
    description: "novel.buffer.save",
    badge: "缓冲",
    searchText: "novel.buffer.save 小说 buffer 缓冲区 保存",
  },
  {
    value: "novel.buffer.publish",
    label: "发布小说缓冲区",
    description: "novel.buffer.publish",
    badge: "缓冲",
    searchText: "novel.buffer.publish 小说 buffer 缓冲区 发布",
  },
  {
    value: "system.setting.update",
    label: "修改系统设置",
    description: "system.setting.update",
    badge: "系统",
    searchText: "system.setting.update 系统 设置 修改",
  },
];

const TARGET_TYPE_OPTIONS: SearchablePickerOption[] = [
  {
    value: "user",
    label: "用户",
    badge: "user",
    searchText: "user 用户",
  },
  {
    value: "comment",
    label: "评论",
    badge: "comment",
    searchText: "comment 评论",
  },
  {
    value: "comment_image",
    label: "评论图片",
    badge: "image",
    searchText: "comment_image 评论图片 图片",
  },
  {
    value: "comic_series",
    label: "漫画系列",
    badge: "comic",
    searchText: "comic_series 漫画 系列",
  },
  {
    value: "comic_part",
    label: "漫画 Part",
    badge: "comic",
    searchText: "comic_part 漫画 part",
  },
  {
    value: "comic_chapter",
    label: "漫画章节",
    badge: "comic",
    searchText: "comic_chapter 漫画 章节",
  },
  {
    value: "comic_page",
    label: "漫画页",
    badge: "comic",
    searchText: "comic_page 漫画 页 图片",
  },
  {
    value: "comic_upload_image",
    label: "漫画待传图片",
    badge: "upload",
    searchText: "comic_upload_image 漫画 待传区 图片",
  },
  {
    value: "novel",
    label: "小说",
    badge: "novel",
    searchText: "novel 小说",
  },
  {
    value: "novel_chapter",
    label: "小说章节",
    badge: "novel",
    searchText: "novel_chapter 小说 章节",
  },
  {
    value: "novel_text_buffer",
    label: "小说缓冲区",
    badge: "buffer",
    searchText: "novel_text_buffer 小说 buffer 缓冲区",
  },
  {
    value: "asset",
    label: "资源文件",
    badge: "asset",
    searchText: "asset 资源 文件 图片",
  },
  {
    value: "site_setting",
    label: "站点设置",
    badge: "system",
    searchText: "site_setting 站点 设置",
  },
];

function buildUserOptions(users: AdminUser[]): SearchablePickerOption[] {
  return users.map((user) => ({
    value: user.id,
    label: user.displayName || user.username,
    description: `@${user.username}`,
    badge: user.role,
    searchText: `${user.id} ${user.username} ${user.displayName} ${user.role}`,
  }));
}

function isTargetPickerSupported(targetType: string) {
  return [
    "user",
    "comic_series",
    "comic_part",
    "comic_chapter",
    "novel",
    "novel_chapter",
  ].includes(targetType);
}

function getTargetPickerMode(targetType: string): TargetPickerMode {
  if (!targetType) {
    return "disabled";
  }

  return isTargetPickerSupported(targetType) ? "picker" : "input";
}

function buildComicTargetOptions(
  comicsTree: AdminComicSeries[],
  targetType: string,
): SearchablePickerOption[] {
  if (targetType === "comic_series") {
    return comicsTree.map((series) => ({
      value: series.id,
      label: series.title || series.slug,
      description: `/${series.slug}`,
      badge: "series",
      searchText: `${series.id} ${series.slug} ${series.title}`,
    }));
  }

  if (targetType === "comic_part") {
    return comicsTree.flatMap((series) =>
      series.parts.map((part) => ({
        value: part.id,
        label: `${series.title || series.slug} / ${part.title || part.slug}`,
        description: `/${series.slug}/${part.slug}`,
        badge: "part",
        searchText: `${part.id} ${part.slug} ${part.title} ${series.id} ${series.slug} ${series.title}`,
      })),
    );
  }

  if (targetType === "comic_chapter") {
    return comicsTree.flatMap((series) =>
      series.parts.flatMap((part) =>
        part.chapters.map((chapter) => ({
          value: chapter.id,
          label: `${series.title || series.slug} / ${part.title || part.slug} / ${
            chapter.title || chapter.slug
          }`,
          description: `/${series.slug}/${part.slug}/${chapter.slug}`,
          badge: "chapter",
          searchText: `${chapter.id} ${chapter.slug} ${chapter.title} ${part.id} ${part.slug} ${part.title} ${series.id} ${series.slug} ${series.title}`,
        })),
      ),
    );
  }

  return [];
}

function buildNovelTargetOptions(
  novelsTree: AdminNovel[],
  targetType: string,
): SearchablePickerOption[] {
  if (targetType === "novel") {
    return novelsTree.map((novel) => ({
      value: novel.id,
      label: novel.title || novel.slug,
      description: `/${novel.slug}`,
      badge: "novel",
      searchText: `${novel.id} ${novel.slug} ${novel.title}`,
    }));
  }

  if (targetType === "novel_chapter") {
    return novelsTree.flatMap((novel) =>
      novel.chapters.map((chapter) => ({
        value: chapter.id,
        label: `${novel.title || novel.slug} / ${chapter.title || chapter.slug}`,
        description: `/${novel.slug}/${chapter.slug}`,
        badge: "chapter",
        searchText: `${chapter.id} ${chapter.slug} ${chapter.title} ${novel.id} ${novel.slug} ${novel.title}`,
      })),
    );
  }

  return [];
}

function getCategoryLabel(category: string) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

function getActionLabel(action: string) {
  return ACTION_OPTIONS.find((option) => option.value === action)?.label ?? action;
}

function getTargetTypeLabel(targetType: string | null) {
  if (!targetType) {
    return "无对象";
  }

  return TARGET_TYPE_OPTIONS.find((option) => option.value === targetType)?.label ?? targetType;
}

function getStatusLabel(status: string) {
  if (status === "success") {
    return "成功";
  }

  if (status === "failed") {
    return "失败";
  }

  return status;
}

function getActorLabel(log: AdminActivityLogItem) {
  if (log.actorDisplayName || log.actorUsername) {
    return log.actorDisplayName || log.actorUsername;
  }

  if (log.actorUserId) {
    return log.actorUserId;
  }

  return "匿名/系统";
}

function getActorSubLabel(log: AdminActivityLogItem) {
  const parts = [
    log.actorUsername ? `@${log.actorUsername}` : null,
    log.actorRole,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "无操作人";
}

function getTargetLabel(log: AdminActivityLogItem) {
  if (log.targetLabel) {
    return log.targetLabel;
  }

  if (log.targetId) {
    return log.targetId;
  }

  return "无对象";
}

function getShortId(value: string | null) {
  if (!value) {
    return "—";
  }

  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function stringifyMetadata(metadata: unknown) {
  if (metadata === null || metadata === undefined || metadata === "") {
    return "";
  }

  if (typeof metadata === "string") {
    return metadata;
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function applyQuickRangeValue(range: QuickRange) {
  if (range === "all") {
    return "";
  }

  const now = new Date();

  if (range === "24h") {
    return toDateTimeLocalValue(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  }

  return toDateTimeLocalValue(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
}

function sortLogs(items: AdminActivityLogItem[], sortMode: SortMode) {
  const sorted = [...items];

  sorted.sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();

    return sortMode === "oldest" ? aTime - bTime : bTime - aTime;
  });

  return sorted;
}

function getActionTone(action: string) {
  if (action.includes(".delete") || action.includes("hard")) {
    return "delete";
  }

  if (action.includes(".create") || action.includes(".register")) {
    return "create";
  }

  if (action.includes(".upload") || action.includes("publish")) {
    return "upload";
  }

  if (action.includes(".rename") || action.includes(".update") || action.includes(".move")) {
    return "update";
  }

  if (action.includes(".login")) {
    return "auth";
  }

  return "default";
}

function AdminActivityLogsPage() {
  const navigate = useNavigate();

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [items, setItems] = useState<AdminActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AdminActivityLogItem | null>(null);
  const [expandedMetadataIds, setExpandedMetadataIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [action, setAction] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [actorUsername, setActorUsername] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [status, setStatus] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [quickRange, setQuickRange] = useState<QuickRange>("all");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [userOptions, setUserOptions] = useState<SearchablePickerOption[]>([]);

  const [comicsTree, setComicsTree] = useState<AdminComicSeries[]>([]);
  const [novelsTree, setNovelsTree] = useState<AdminNovel[]>([]);

  const maxPage = useMemo(() => {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  const currentPage = useMemo(() => {
    return Math.floor(offset / PAGE_SIZE) + 1;
  }, [offset]);

  const visibleItems = useMemo(() => {
    return sortLogs(items, sortMode);
  }, [items, sortMode]);

  const targetPickerMode = useMemo(() => {
    return getTargetPickerMode(targetType);
  }, [targetType]);

  const targetObjectOptions = useMemo(() => {
    if (targetType === "user") {
      return userOptions;
    }

    if (targetType.startsWith("comic_")) {
      return buildComicTargetOptions(comicsTree, targetType);
    }

    if (targetType.startsWith("novel")) {
      return buildNovelTargetOptions(novelsTree, targetType);
    }

    return [];
  }, [targetType, userOptions, comicsTree, novelsTree]);

  const successCount = useMemo(() => {
    return items.filter((item) => item.status === "success").length;
  }, [items]);

  const failedCount = useMemo(() => {
    return items.filter((item) => item.status === "failed").length;
  }, [items]);

  useEffect(() => {
    async function checkLogin() {
      try {
        const user = await getMe();

        if (user.role !== "admin") {
          navigate("/admin/login", { replace: true });
          return;
        }

        setIsAuthReady(true);
      } catch {
        clearAccessToken();
        navigate("/admin/login", { replace: true });
      }
    }

    checkLogin();
  }, [navigate]);

  async function loadPickerOptions() {
    setIsPickerLoading(true);

    try {
      const [users, comics, novels] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminComicsTree(),
        fetchAdminNovelsTree(),
      ]);

      setUserOptions(buildUserOptions(users));
      setComicsTree(comics);
      setNovelsTree(novels);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载筛选候选项失败");
    } finally {
      setIsPickerLoading(false);
    }
  }

  async function loadLogs(nextOffset = offset) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await adminListActivityLogs({
        keyword: keyword.trim() || undefined,
        category: category || undefined,
        action: action || undefined,
        actorUserId: actorUserId || undefined,
        actorUsername: actorUsername.trim() || undefined,
        targetType: targetType || undefined,
        targetId: targetId.trim() || undefined,
        status: status || undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });

      setItems(data.items);
      setTotal(data.total);
      setOffset(data.offset);

      if (selectedLog) {
        const nextSelected = data.items.find((item) => item.id === selectedLog.id);
        setSelectedLog(nextSelected ?? data.items[0] ?? null);
      } else {
        setSelectedLog(data.items[0] ?? null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载操作日志失败");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthReady) {
      loadLogs(0);
      loadPickerOptions();
    }
  }, [isAuthReady]);

  function handleSearch() {
    loadLogs(0);
  }

  function handleReset() {
    setKeyword("");
    setCategory("");
    setAction("");
    setActorUserId("");
    setActorUsername("");
    setTargetType("");
    setTargetId("");
    setStatus("");
    setCreatedFrom("");
    setCreatedTo("");
    setSortMode("newest");
    setQuickRange("all");
    setOffset(0);
    setSelectedLog(null);

    window.setTimeout(() => {
      loadLogs(0);
    }, 0);
  }

  function handleRangeChange(nextRange: QuickRange) {
    setQuickRange(nextRange);
    setCreatedFrom(applyQuickRangeValue(nextRange));
  }

  function toggleMetadata(logId: string) {
    setExpandedMetadataIds((current) => {
      const next = new Set(current);

      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }

      return next;
    });
  }

  function removeFilter(key: string) {
    if (key === "keyword") {
      setKeyword("");
    } else if (key === "category") {
      setCategory("");
    } else if (key === "action") {
      setAction("");
    } else if (key === "actorUserId") {
      setActorUserId("");
    } else if (key === "actorUsername") {
      setActorUsername("");
    } else if (key === "targetType") {
      setTargetType("");
      setTargetId("");
    } else if (key === "targetId") {
      setTargetId("");
    } else if (key === "status") {
      setStatus("");
    } else if (key === "time") {
      setCreatedFrom("");
      setCreatedTo("");
      setQuickRange("all");
    }
  }

  const activeFilterChips = [
    keyword ? { key: "keyword", label: `关键词：${keyword}` } : null,
    category ? { key: "category", label: `分类：${getCategoryLabel(category)}` } : null,
    action ? { key: "action", label: `操作：${getActionLabel(action)}` } : null,
    actorUserId
      ? {
          key: "actorUserId",
          label: `操作人：${
            userOptions.find((option) => option.value === actorUserId)?.label ?? actorUserId
          }`,
        }
      : null,
    actorUsername ? { key: "actorUsername", label: `历史用户名：${actorUsername}` } : null,
    targetType ? { key: "targetType", label: `对象：${getTargetTypeLabel(targetType)}` } : null,
    targetId ? { key: "targetId", label: `对象 ID：${getShortId(targetId)}` } : null,
    status ? { key: "status", label: `状态：${getStatusLabel(status)}` } : null,
    createdFrom || createdTo
      ? {
          key: "time",
          label: `时间：${createdFrom || "不限"} → ${createdTo || "不限"}`,
        }
      : null,
  ].filter(Boolean) as { key: string; label: string }[];

  if (!isAuthReady) {
    return (
      <main className="admin-page-shell px-6 py-10">
        <section className="mx-auto max-w-7xl">
          <p className="text-sm text-soft">正在检查登录状态...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page-shell px-4 py-3 md:px-5 md:py-4">
      <section className="mx-auto max-w-[1540px]">
        <div className="log-console-header">
          <div>
            <Link
              to="/admin"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              ← 返回后台首页
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-strong">操作日志</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              按业务事件查看登录、评论、上传、内容管理等关键操作。默认时间倒序，点击日志行可查看完整上下文。
            </p>
          </div>

          <div className="log-console-summary">
            <div className="log-summary-card">
              <span className="log-summary-label">匹配总数</span>
              <strong>{total}</strong>
            </div>
            <div className="log-summary-card log-summary-success">
              <span className="log-summary-label">本页成功</span>
              <strong>{successCount}</strong>
            </div>
            <div className="log-summary-card log-summary-failed">
              <span className="log-summary-label">本页失败</span>
              <strong>{failedCount}</strong>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="admin-message-error mt-5 px-4 py-3 text-sm">
            {errorMessage}
          </div>
        )}

        <section className="log-filter-console mt-6">
          <div className="log-filter-main-row">
            <div className="log-search-box">
              <span className="log-search-icon">⌕</span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="log-search-input"
                placeholder="搜索 action、对象名称、说明、用户名快照..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
            </div>

            <div className="log-segmented-control" aria-label="状态筛选">
              <button
                type="button"
                className={status === "" ? "is-active" : ""}
                onClick={() => setStatus("")}
              >
                全部
              </button>
              <button
                type="button"
                className={status === "success" ? "is-active is-success" : ""}
                onClick={() => setStatus("success")}
              >
                成功
              </button>
              <button
                type="button"
                className={status === "failed" ? "is-active is-failed" : ""}
                onClick={() => setStatus("failed")}
              >
                失败
              </button>
            </div>

            <div className="log-sort-switch" title="切换当前页排序">
              <button
                type="button"
                className={sortMode === "newest" ? "is-active" : ""}
                onClick={() => setSortMode("newest")}
              >
                ↑
              </button>
              <button
                type="button"
                className={sortMode === "oldest" ? "is-active" : ""}
                onClick={() => setSortMode("oldest")}
              >
                ↓
              </button>
            </div>

            <button
              type="button"
              className="admin-button-primary log-query-button"
              onClick={handleSearch}
            >
              查询
            </button>
          </div>

          <div className="log-facet-row">
            <div className="log-facet-picker">
              <span>操作人</span>
              <SearchablePicker
                value={actorUserId}
                options={userOptions}
                isLoading={isPickerLoading}
                placeholder="全部操作人"
                searchPlaceholder="搜索用户名、显示名或 ID"
                emptyText="没有匹配的用户"
                onChange={setActorUserId}
              />
            </div>

            <div className="log-facet-picker">
              <span>分类</span>
              <SearchablePicker
                value={category}
                options={CATEGORY_OPTIONS}
                placeholder="全部分类"
                searchPlaceholder="搜索分类"
                emptyText="没有匹配的分类"
                onChange={setCategory}
              />
            </div>

            <div className="log-facet-picker log-facet-wide">
              <span>操作类型</span>
              <SearchablePicker
                value={action}
                options={ACTION_OPTIONS}
                placeholder="全部操作"
                searchPlaceholder="搜索操作名称或 action"
                emptyText="没有匹配的操作"
                onChange={setAction}
              />
            </div>

            <div className="log-range-pills" aria-label="时间范围">
              <button
                type="button"
                className={quickRange === "all" ? "is-active" : ""}
                onClick={() => handleRangeChange("all")}
              >
                全部时间
              </button>
              <button
                type="button"
                className={quickRange === "24h" ? "is-active" : ""}
                onClick={() => handleRangeChange("24h")}
              >
                24h
              </button>
              <button
                type="button"
                className={quickRange === "7d" ? "is-active" : ""}
                onClick={() => handleRangeChange("7d")}
              >
                7d
              </button>
            </div>

            <button
              type="button"
              className={[
                "log-advanced-toggle",
                showAdvanced ? "is-open" : "",
              ].join(" ")}
              onClick={() => setShowAdvanced((value) => !value)}
            >
              高级筛选
              <span>{showAdvanced ? "▴" : "▾"}</span>
            </button>

            <button
              type="button"
              className="log-reset-button"
              onClick={handleReset}
            >
              重置
            </button>
          </div>

          <div className={["log-advanced-panel", showAdvanced ? "is-open" : ""].join(" ")}>
            <div className="log-advanced-grid">
              <label>
                <span>对象类型</span>
                <SearchablePicker
                  value={targetType}
                  options={TARGET_TYPE_OPTIONS}
                  placeholder="选择对象类型"
                  searchPlaceholder="搜索对象类型"
                  emptyText="没有匹配的对象类型"
                  onChange={(value) => {
                    setTargetType(value);
                    setTargetId("");
                  }}
                />
              </label>

              <label>
                <span>对象</span>
                {targetPickerMode === "picker" ? (
                  <SearchablePicker
                    value={targetId}
                    options={targetObjectOptions}
                    isLoading={isPickerLoading}
                    placeholder="选择现有对象"
                    searchPlaceholder="搜索标题、slug、用户名或 ID"
                    emptyText="没有匹配的对象"
                    onChange={setTargetId}
                  />
                ) : (
                  <input
                    value={targetId}
                    onChange={(event) => setTargetId(event.target.value)}
                    disabled={targetPickerMode === "disabled"}
                    className="admin-input w-full px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={
                      targetPickerMode === "disabled"
                        ? "先选择对象类型"
                        : "当前对象类型暂不支持 Picker，可粘贴 target_id"
                    }
                  />
                )}
              </label>

              <label>
                <span>历史用户名快照</span>
                <input
                  value={actorUsername}
                  onChange={(event) => setActorUsername(event.target.value)}
                  className="admin-input w-full px-3 py-2 text-sm"
                  placeholder="用于查历史用户名文本"
                />
              </label>

              <label>
                <span>开始时间</span>
                <input
                  type="datetime-local"
                  value={createdFrom}
                  onChange={(event) => {
                    setCreatedFrom(event.target.value);
                    setQuickRange("all");
                  }}
                  className="admin-input w-full px-3 py-2 text-sm"
                />
              </label>

              <label>
                <span>结束时间</span>
                <input
                  type="datetime-local"
                  value={createdTo}
                  onChange={(event) => {
                    setCreatedTo(event.target.value);
                    setQuickRange("all");
                  }}
                  className="admin-input w-full px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          {activeFilterChips.length > 0 && (
            <div className="log-active-filter-row">
              <span className="text-xs text-soft">当前筛选</span>
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="log-filter-chip"
                  onClick={() => removeFilter(chip.key)}
                >
                  {chip.label}
                  <span>×</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="log-console-layout mt-6">
          <section className="log-stream-panel">
            <div className="log-stream-toolbar">
              <div>
                <h2>事件流</h2>
                <p>
                  第 {currentPage} / {maxPage} 页 · 本页 {visibleItems.length} 条 · 偏移 {offset}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={offset <= 0 || isLoading}
                  className="admin-button-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => loadLogs(Math.max(0, offset - PAGE_SIZE))}
                >
                  上一页
                </button>
                <button
                  type="button"
                  disabled={offset + PAGE_SIZE >= total || isLoading}
                  className="admin-button-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => loadLogs(offset + PAGE_SIZE)}
                >
                  下一页
                </button>
              </div>
            </div>

            <div className="log-stream-list">
              {isLoading ? (
                <p className="px-5 py-10 text-sm text-soft">正在加载操作日志...</p>
              ) : visibleItems.length === 0 ? (
                <p className="px-5 py-10 text-sm text-soft">没有匹配的操作日志。</p>
              ) : (
                visibleItems.map((log) => {
                  const metadataText = stringifyMetadata(log.metadata);
                  const isMetadataExpanded = expandedMetadataIds.has(log.id);
                  const selected = selectedLog?.id === log.id;
                  const actionTone = getActionTone(log.action);

                  return (
                    <article
                      key={log.id}
                      className={[
                        "log-event-row",
                        selected ? "is-selected" : "",
                        log.status === "failed" ? "is-failed" : "is-success",
                        `tone-${actionTone}`,
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        className="log-event-main"
                        onClick={() => setSelectedLog(log)}
                      >
                        <span className="log-event-time">
                          {formatChinaDateTimeToMinute(log.createdAt)}
                        </span>

                        <span className="log-event-state">
                          <span className="log-event-dot" />
                          {getStatusLabel(log.status)}
                        </span>

                        <span className="log-event-action">
                          <span className="log-action-label">{getActionLabel(log.action)}</span>
                          <span className="log-action-code">{log.action}</span>
                        </span>

                        <span className="log-event-actor">
                          <span>{getActorLabel(log)}</span>
                          <em>{getActorSubLabel(log)}</em>
                        </span>

                        <span className="log-event-target">
                          <span>{getTargetTypeLabel(log.targetType)}</span>
                          <em>{getTargetLabel(log)}</em>
                        </span>

                        <span className="log-event-message">
                          {log.message || "无说明"}
                        </span>
                      </button>

                      {metadataText && (
                        <div className="log-event-extra">
                          <button
                            type="button"
                            className="log-metadata-toggle"
                            onClick={() => toggleMetadata(log.id)}
                          >
                            {isMetadataExpanded ? "收起 metadata" : "metadata"}
                          </button>

                          {isMetadataExpanded && (
                            <pre className="log-metadata-block">{metadataText}</pre>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <aside className="log-detail-panel">
            <div className="log-detail-head">
              <h2>详情</h2>
              {selectedLog && (
                <span
                  className={[
                    "log-detail-status",
                    selectedLog.status === "failed" ? "is-failed" : "is-success",
                  ].join(" ")}
                >
                  {getStatusLabel(selectedLog.status)}
                </span>
              )}
            </div>

            {!selectedLog ? (
              <p className="mt-4 text-sm text-soft">选择一条日志查看完整信息。</p>
            ) : (
              <div className="log-detail-body">
                <section>
                  <h3>事件</h3>
                  <dl>
                    <div>
                      <dt>ID</dt>
                      <dd>{selectedLog.id}</dd>
                    </div>
                    <div>
                      <dt>时间</dt>
                      <dd>{formatChinaDateTimeToMinute(selectedLog.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>分类</dt>
                      <dd>{getCategoryLabel(selectedLog.category)}</dd>
                    </div>
                    <div>
                      <dt>Action</dt>
                      <dd>{selectedLog.action}</dd>
                    </div>
                    <div>
                      <dt>说明</dt>
                      <dd>{selectedLog.message || "—"}</dd>
                    </div>
                    <div>
                      <dt>错误码</dt>
                      <dd>{selectedLog.errorCode || "—"}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3>操作人</h3>
                  <dl>
                    <div>
                      <dt>用户 ID</dt>
                      <dd>{selectedLog.actorUserId || "—"}</dd>
                    </div>
                    <div>
                      <dt>用户名</dt>
                      <dd>{selectedLog.actorUsername || "—"}</dd>
                    </div>
                    <div>
                      <dt>显示名</dt>
                      <dd>{selectedLog.actorDisplayName || "—"}</dd>
                    </div>
                    <div>
                      <dt>角色</dt>
                      <dd>{selectedLog.actorRole || "—"}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3>对象</h3>
                  <dl>
                    <div>
                      <dt>类型</dt>
                      <dd>{getTargetTypeLabel(selectedLog.targetType)}</dd>
                    </div>
                    <div>
                      <dt>ID</dt>
                      <dd>{selectedLog.targetId || "—"}</dd>
                    </div>
                    <div>
                      <dt>名称</dt>
                      <dd>{selectedLog.targetLabel || "—"}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3>来源</h3>
                  <dl>
                    <div>
                      <dt>IP</dt>
                      <dd>{selectedLog.ipAddress || "—"}</dd>
                    </div>
                    <div>
                      <dt>UA</dt>
                      <dd>{selectedLog.userAgent || "—"}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3>Metadata</h3>
                  {stringifyMetadata(selectedLog.metadata) ? (
                    <pre className="log-detail-metadata">
                      {stringifyMetadata(selectedLog.metadata)}
                    </pre>
                  ) : (
                    <p className="text-sm text-soft">无 metadata。</p>
                  )}
                </section>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

export default AdminActivityLogsPage;