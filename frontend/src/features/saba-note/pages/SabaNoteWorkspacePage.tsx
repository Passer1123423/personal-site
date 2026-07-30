import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SearchablePicker from "../../../components/SearchablePicker";
import MarkdownWorkspace from "../components/MarkdownWorkspace";
import SabaNoteShell from "../components/SabaNoteShell";
import TagPicker from "../components/TagPicker";
import {
  getCategory,
  sabaNoteCategories,
  sabaNoteDerivations,
  sabaNoteNodes,
  sabaNoteTags,
} from "../data/mockData";
import { DERIVATION_STATUS_OPTIONS } from "../data/statuses";
import useSabaNoteDraft from "../hooks/useSabaNoteDraft";
import type {
  DraftSaveStatus,
  MobileWorkspacePanel,
  SabaNoteDraft,
} from "../types";

const SAVE_STATUS_TEXT: Record<DraftSaveStatus, string> = {
  dirty: "有改动，等待保存",
  saving: "正在保存本地草稿…",
  saved: "本地草稿已保存",
};

export default function SabaNoteWorkspacePage() {
  const [searchParams] = useSearchParams();
  const derivationId = searchParams.get("id");
  const source = sabaNoteDerivations.find(
    (item) => item.id === derivationId,
  );
  const [mobilePanel, setMobilePanel] =
    useState<MobileWorkspacePanel>("edit");

  const initialDraft = useMemo<SabaNoteDraft>(
    () =>
      source
        ? {
            title: source.title,
            summary: source.summary,
            contentMd: source.contentMd,
            status: source.status,
            nodeId: source.nodeId,
            tagIds: source.tagIds,
          }
        : {
            title: "",
            summary: "",
            contentMd: "",
            status: "developing",
            nodeId: "",
            tagIds: [],
          },
    [source],
  );

  const { draft, saveStatus, savedAt, update } = useSabaNoteDraft(
    source?.id ?? "new",
    initialDraft,
  );

  const selectedNode =
    sabaNoteNodes.find((node) => node.id === draft.nodeId) ?? null;
  const selectedCategory = selectedNode
    ? getCategory(selectedNode.categoryId)
    : null;

  const informationPanel = (
    <section className="surface-card saba-note-workspace-information">
      <div className="saba-note-pane-heading">
        <div>
          <span>推导信息</span>
          <p>结构只用于补充内容语境。</p>
        </div>
        {selectedCategory && (
          <span className="saba-note-pane-kicker">
            {selectedCategory.name}
          </span>
        )}
      </div>

      <div className="saba-note-workspace-fields">
        <label className="saba-note-field saba-note-field-title">
          <span>标题</span>
          <input
            className="admin-input"
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="这次理解了什么？"
          />
        </label>

        <label className="saba-note-field saba-note-field-summary">
          <span>Summary</span>
          <textarea
            className="admin-textarea"
            value={draft.summary}
            onChange={(event) => update("summary", event.target.value)}
            placeholder="用一两句话留下这条推导的核心变化。"
          />
        </label>

        <label className="saba-note-field">
          <span>状态</span>
          <SearchablePicker
            value={draft.status}
            onChange={(value) => update("status", value)}
            options={DERIVATION_STATUS_OPTIONS}
            placeholder="选择推导状态"
            searchPlaceholder="搜索状态"
          />
        </label>

        <label className="saba-note-field">
          <span>Node</span>
          <SearchablePicker
            value={draft.nodeId}
            onChange={(value) => update("nodeId", value)}
            options={sabaNoteNodes.map((node) => ({
              value: node.id,
              label: node.title,
              description:
                sabaNoteCategories.find(
                  (category) => category.id === node.categoryId,
                )?.name ?? "",
            }))}
            placeholder="暂不绑定 Node"
            searchPlaceholder="搜索 Node"
          />
        </label>

        <div className="saba-note-field saba-note-field-tags">
          <span>Tag</span>
          <TagPicker
            tags={sabaNoteTags}
            value={draft.tagIds}
            onChange={(value) => update("tagIds", value)}
          />
        </div>
      </div>
    </section>
  );

  return (
    <SabaNoteShell
      wide
      eyebrow="推导工作台"
      actions={
        <Link
          to={
            source
              ? `/saba-note/derivation/${source.id}`
              : "/saba-note"
          }
          className="admin-button-secondary px-3 py-2 text-sm font-semibold"
        >
          {source ? "返回阅读" : "返回内容流"}
        </Link>
      }
    >
      <header className="saba-note-workspace-header">
        <div>
          <p className="saba-note-eyebrow">
            {source ? "继续推导" : "新建推导"}
          </p>
          <h1>{draft.title || "无标题推导"}</h1>
        </div>

        <div
          className={`saba-note-save-state saba-note-save-state-${saveStatus}`}
          aria-live="polite"
        >
          <span />
          <div>
            <strong>{SAVE_STATUS_TEXT[saveStatus]}</strong>
            <small>
              {savedAt
                ? `最近保存 ${savedAt.toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}`
                : "第一阶段仅保存在当前浏览器"}
            </small>
          </div>
        </div>
      </header>

      <div className="saba-note-mobile-tabs" aria-label="工作台区域">
        {(
          [
            ["edit", "编辑"],
            ["preview", "预览"],
            ["info", "信息"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={mobilePanel === value ? "active" : ""}
            onClick={() => setMobilePanel(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className={
          mobilePanel === "info"
            ? "saba-note-information-wrap mobile-active"
            : "saba-note-information-wrap"
        }
      >
        {informationPanel}
      </div>

      <MarkdownWorkspace
        value={draft.contentMd}
        onChange={(value) => update("contentMd", value)}
        mobilePanel={mobilePanel}
      />
    </SabaNoteShell>
  );
}
