import { useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import SearchablePicker from "../../../components/SearchablePicker";
import { httpSabaNoteApi } from "../api";
import MarkdownWorkspace from "../components/MarkdownWorkspace";
import SabaNoteAsyncState from "../components/SabaNoteAsyncState";
import SabaNoteShell from "../components/SabaNoteShell";
import TagPicker from "../components/TagPicker";
import { DERIVATION_STATUS_OPTIONS } from "../data/statuses";
import useDerivationActions from "../hooks/useDerivationActions";
import useDerivationEditor from "../hooks/useDerivationEditor";
import useSabaNoteDraft from "../hooks/useSabaNoteDraft";
import useUnsavedChangesWarning from "../hooks/useUnsavedChangesWarning";
import useWorkspaceData from "../hooks/useWorkspaceData";
import type {
  DerivationStatus,
  DerivationView,
  DraftSaveStatus,
  MobileWorkspacePanel,
  SabaNoteDraft,
  SabaNoteLookups,
} from "../types";

const SAVE_STATUS_TEXT: Record<DraftSaveStatus, string> = {
  dirty: "后端尚未保存",
  saving: "正在缓存本地草稿…",
  saved: "本地草稿已缓存",
};

export default function SabaNoteWorkspacePage() {
  const [searchParams] = useSearchParams();
  const derivationId = searchParams.get("id");
  const { derivation, lookups, referenceCandidates, loading, error } =
    useWorkspaceData(derivationId);

  if (loading || error || (derivationId && !derivation)) {
    return (
      <SabaNoteShell wide hideHeader>
        <div className="py-8">
          <SabaNoteAsyncState
            kind={loading ? "loading" : "error"}
            title={loading ? "正在准备工作台" : "工作台数据加载失败"}
            description={
              error ??
              (derivationId && !derivation
                ? "没有找到目标 Derivation。"
                : undefined)
            }
          />
        </div>
      </SabaNoteShell>
    );
  }

  return (
    <WorkspaceEditor
      key={derivation?.derivation.id ?? "new"}
      source={derivation}
      lookups={lookups}
      derivationCandidates={referenceCandidates}
    />
  );
}

function WorkspaceEditor({
  source,
  lookups,
  derivationCandidates,
}: {
  source: DerivationView | null;
  lookups: SabaNoteLookups;
  derivationCandidates: DerivationView[];
}) {
  const navigate = useNavigate();
  const [mobilePanel, setMobilePanel] =
    useState<MobileWorkspacePanel>("edit");
  const [workspaceTags, setWorkspaceTags] = useState(lookups.tags);

  const initialDraft = useMemo<SabaNoteDraft>(
    () =>
      source
        ? {
            title: source.derivation.title,
            contentMd: source.derivation.contentMd,
            status: source.derivation.status,
            nodeId: source.derivation.nodeId,
            tagIds: source.tags.map((tag) => tag.id),
          }
        : {
            title: "",
            contentMd: "",
            status: "draft",
            nodeId: null,
            tagIds: [],
          },
    [source],
  );

  const {
    draft,
    cachedDraft,
    saveStatus: draftSaveStatus,
    savedAt: draftSavedAt,
    isDirty,
    update,
    clearCachedDraft,
    restoreCachedDraft,
    markBackendSaved,
  } = useSabaNoteDraft(
    source?.derivation.id ?? "new",
    initialDraft,
  );
  const {
    save,
    saveStatus: backendSaveStatus,
    savedAt: backendSavedAt,
    error: saveError,
  } = useDerivationEditor(source);
  const {
    discard,
    pendingId: actionPendingId,
    error: actionError,
  } = useDerivationActions();

  useUnsavedChangesWarning(isDirty);

  const isSaving = backendSaveStatus === "saving";
  const statusTitle =
    backendSaveStatus === "saving"
      ? "正在写入 Saba-Note…"
      : backendSaveStatus === "error"
        ? "后端保存失败"
        : isDirty
          ? SAVE_STATUS_TEXT[draftSaveStatus]
          : backendSaveStatus === "saved"
            ? "已保存到知识引擎"
            : SAVE_STATUS_TEXT[draftSaveStatus];
  const statusTime = backendSavedAt ?? draftSavedAt;

  async function handleSave() {
    try {
      const savedDraft = { ...draft, title: draft.title.trim() };
      const id = await save(savedDraft);
      markBackendSaved(savedDraft);
      if (!source) {
        navigate(`/saba-note/workspace?id=${encodeURIComponent(id)}`, {
          replace: true,
        });
      }
    } catch {
      // 错误状态由 useDerivationEditor 暴露给界面。
    }
  }

  async function handleDiscard() {
    if (!source) return;
    try {
      await discard(source.derivation.id);
      clearCachedDraft();
      navigate("/saba-note/trash");
    } catch {
      // 错误状态由 useDerivationActions 暴露给界面。
    }
  }

  async function handleCreateTag(name: string) {
    const created = await httpSabaNoteApi.graph.createTag(name);
    setWorkspaceTags((current) => [...current, created]);
    return created;
  }

  const selectedNode =
    lookups.nodes.find((node) => node.id === draft.nodeId) ?? null;
  const selectedCategory = selectedNode
    ? lookups.categories.find(
        (category) => category.id === selectedNode.categoryId,
      ) ?? null
    : null;
  const referenceCandidates = derivationCandidates.filter(
    (item) =>
      !item.derivation.isDiscarded &&
      item.derivation.id !== source?.derivation.id,
  );

  const informationPanel = (
    <aside className="saba-note-workspace-information">
      <div className="saba-note-pane-heading">
        <span>内容属性</span>
        {selectedCategory && (
          <span className="saba-note-pane-kicker">
            {selectedCategory.name}
          </span>
        )}
      </div>

      <div className="saba-note-workspace-fields">
        <label className="saba-note-field">
          <span>状态</span>
          <SearchablePicker
            value={draft.status}
            onChange={(value) =>
              update("status", value as DerivationStatus)
            }
            options={DERIVATION_STATUS_OPTIONS}
            placeholder="选择推导状态"
            searchPlaceholder="搜索状态"
          />
        </label>

        <label className="saba-note-field">
          <span>归档</span>
          <SearchablePicker
            value={draft.nodeId ?? ""}
            onChange={(value) => update("nodeId", value || null)}
            options={[
              {
                value: "",
                label: "未归档",
                description: "先随便写点想法，整理丢给未来",
              },
              ...lookups.nodes.map((node) => ({
                value: node.id,
                label: node.title,
                description:
                  lookups.categories.find(
                    (category) => category.id === node.categoryId,
                  )?.name ?? "",
              })),
            ]}
            placeholder="未归档"
            searchPlaceholder="搜索 Node"
            emptyText="没有匹配的 Node；当前推导仍可保持未归档"
          />
        </label>

        <div className="saba-note-field saba-note-field-tags">
          <TagPicker
            tags={workspaceTags}
            value={draft.tagIds}
            onChange={(value) => update("tagIds", value)}
            onCreate={handleCreateTag}
          />
        </div>
      </div>
    </aside>
  );

  return (
    <SabaNoteShell
      wide
      hideHeader
    >
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

      <section className="surface-card saba-note-workspace-canvas">
        <div className="saba-note-workspace-body">
          <div
            className={
              mobilePanel === "info"
                ? "saba-note-information-wrap mobile-active"
                : "saba-note-information-wrap"
            }
          >
            {informationPanel}
          </div>

          <div
            className={[
              "saba-note-writing-area",
              mobilePanel === "info" ? "saba-note-writing-area-hidden" : "",
            ].join(" ")}
          >
            <header className="saba-note-writing-header">
              {cachedDraft && (
                <div className="saba-note-draft-recovery" role="status">
                  <span>检测到当前内容的本地恢复草稿。</span>
                  <div>
                    <button
                      type="button"
                      onClick={restoreCachedDraft}
                    >
                      恢复草稿
                    </button>
                    <button
                      type="button"
                      onClick={clearCachedDraft}
                    >
                      忽略
                    </button>
                  </div>
                </div>
              )}
              <div className="saba-note-writing-title-row">
                <input
                  className="saba-note-title-input"
                  value={draft.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="标题不写默认是未命名推导"
                />

                <div className="saba-note-writing-actions">
                  <div
                    className={`saba-note-save-state saba-note-save-state-${draftSaveStatus}`}
                    aria-live="polite"
                  >
                    <span />
                    <div>
                      <strong>{statusTitle}</strong>
                      <small>
                        {statusTime
                          ? `最近记录 ${statusTime.toLocaleTimeString("zh-CN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}`
                          : "尚未写入后端"}
                      </small>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="saba-note-workspace-command"
                    disabled={isSaving}
                    onClick={() => void handleSave()}
                  >
                    {isSaving ? "保存中…" : "保存"}
                  </button>

                  <button
                    type="button"
                    className="saba-note-workspace-command saba-note-workspace-command-danger"
                    disabled={!source || actionPendingId !== null}
                    title={source ? "移入回收站" : "请先保存 Derivation"}
                    onClick={() => void handleDiscard()}
                  >
                    {actionPendingId ? "弃置中…" : "弃置"}
                  </button>

                  <Link
                    to={"/saba-note"}
                    className="saba-note-workspace-back"
                  >
                    返回内容流
                  </Link>
                </div>
              </div>
              {(saveError || actionError) && (
                <p className="saba-note-workspace-error" role="alert">
                  {saveError ?? actionError}
                </p>
              )}
            </header>

            <MarkdownWorkspace
              value={draft.contentMd}
              onChange={(value) => update("contentMd", value)}
              mobilePanel={mobilePanel}
              referenceCandidates={referenceCandidates}
            />
          </div>
        </div>
      </section>
    </SabaNoteShell>
  );
}
