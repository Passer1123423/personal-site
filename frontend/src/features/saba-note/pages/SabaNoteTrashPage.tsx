import { Link } from "react-router-dom";

import DerivationMeta from "../components/DerivationMeta";
import SabaNoteAsyncState from "../components/SabaNoteAsyncState";
import SabaNoteShell from "../components/SabaNoteShell";
import useDerivationActions from "../hooks/useDerivationActions";
import useDerivationList from "../hooks/useDerivationList";
import { getDerivationDisplayTitle } from "../utils/derivation";

export default function SabaNoteTrashPage() {
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useDerivationList({ discarded: true });
  const {
    restore,
    purge,
    pendingId,
    error: actionError,
  } = useDerivationActions();

  async function handleRestore(id: string) {
    try {
      await restore(id);
      reload();
    } catch {
      // 错误状态由 useDerivationActions 暴露给界面。
    }
  }

  async function handlePurge(id: string, title: string) {
    const confirmed = window.confirm(
      `永久删除“${title}”？此操作无法撤销。`,
    );
    if (!confirmed) return;

    try {
      await purge(id);
      reload();
    } catch {
      // 错误状态由 useDerivationActions 暴露给界面。
    }
  }

  return (
    <SabaNoteShell
      eyebrow="回收站"
      actions={
        <Link
          to="/saba-note"
          className="admin-button-secondary px-3 py-2 text-sm font-semibold"
        >
          返回内容流
        </Link>
      }
    >
      <div className="saba-note-trash-page">
        <div className="saba-note-trash-heading">
          <h1>已弃置的推导</h1>
          <p>恢复会回到内容流；永久删除需要再次确认。</p>
        </div>

        {(loadError || actionError) && (
          <p className="saba-note-inline-error" role="alert">
            {loadError ?? actionError}
          </p>
        )}

        {loading ? (
          <SabaNoteAsyncState
            kind="loading"
            title="正在读取回收站"
          />
        ) : data.length === 0 ? (
          <SabaNoteAsyncState
            title="回收站为空"
            description="被弃置的 Derivation 会出现在这里。"
          />
        ) : (
          <div className="saba-note-trash-list">
            {data.map(({ derivation, category, node, tags, excerpt }) => (
              <article
                key={derivation.id}
                className="surface-card saba-note-trash-item"
              >
                <div>
                  <DerivationMeta
                    status={derivation.status}
                    category={category}
                    node={node}
                    tags={tags}
                    compact
                  />
                  <h2>
                    {getDerivationDisplayTitle(derivation.title)}
                  </h2>
                  <p>{excerpt || "这条推导没有正文摘要。"}</p>
                </div>
                <div className="saba-note-trash-actions">
                  <button
                    type="button"
                    className="admin-button-secondary px-3 py-2 text-sm font-semibold"
                    disabled={pendingId === derivation.id}
                    onClick={() =>
                      void handleRestore(derivation.id)
                    }
                  >
                    恢复
                  </button>
                  <button
                    type="button"
                    className="saba-note-workspace-command saba-note-workspace-command-danger"
                    disabled={pendingId === derivation.id}
                    onClick={() =>
                      void handlePurge(
                        derivation.id,
                        getDerivationDisplayTitle(derivation.title),
                      )
                    }
                  >
                    永久删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </SabaNoteShell>
  );
}
