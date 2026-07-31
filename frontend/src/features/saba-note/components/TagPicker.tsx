import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import SearchBox from "../../../components/SearchBox";
import type { Tag } from "../types";

type TagPickerProps = {
  tags: Tag[];
  value: string[];
  onChange: (tagIds: string[]) => void;
  onCreate: (name: string) => Promise<Tag>;
};

export default function TagPicker({
  tags,
  value,
  onChange,
  onCreate,
}: TagPickerProps) {
  const [keyword, setKeyword] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const filteredTags = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return tags;
    }
    return tags.filter((tag) => tag.name.toLowerCase().includes(normalized));
  }, [keyword, tags]);

  function toggle(tagId: string) {
    onChange(
      value.includes(tagId)
        ? value.filter((item) => item !== tagId)
        : [...value, tagId],
    );
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newTagName.trim();

    if (!name) {
      setCreateError("请输入 Tag 名称。");
      return;
    }

    const existing = tags.find(
      (tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (existing) {
      if (!value.includes(existing.id)) {
        onChange([...value, existing.id]);
      }
      setKeyword("");
      setNewTagName("");
      setCreateError(null);
      setCreating(false);
      return;
    }

    setCreatePending(true);
    setCreateError(null);
    try {
      const created = await onCreate(name);
      onChange([...value, created.id]);
      setKeyword("");
      setNewTagName("");
      setCreating(false);
    } catch (reason) {
      setCreateError(
        reason instanceof Error ? reason.message : "新建 Tag 失败。",
      );
    } finally {
      setCreatePending(false);
    }
  }

  return (
    <div className="saba-note-tag-picker">
      <div className="saba-note-tag-heading">
        <span>Tag</span>
        <button
          type="button"
          className="saba-note-tag-create-toggle"
          aria-expanded={creating}
          onClick={() => {
            setCreating((current) => !current);
            setCreateError(null);
          }}
        >
          {creating ? "收起" : "+ 新建 Tag"}
        </button>
      </div>

      <SearchBox
        value={keyword}
        onChange={setKeyword}
        placeholder="查找 Tag"
        className="saba-note-tag-search"
      />

      {creating && (
        <form className="saba-note-tag-create-form" onSubmit={handleCreate}>
          <div className="saba-note-tag-create-row">
            <input
              autoFocus
              value={newTagName}
              placeholder="输入新 Tag 名称"
              aria-label="新 Tag 名称"
              onChange={(event) => setNewTagName(event.target.value)}
            />
            <button type="submit" disabled={createPending}>
              {createPending ? "创建中…" : "创建并选中"}
            </button>
          </div>
          <p>
            这里只提供写作中的快捷创建；重命名、删除和完整整理仍在
            <Link to="/saba-note/manage?view=tags"> Manage</Link>。
          </p>
          {createError && (
            <p className="saba-note-tag-create-error" role="alert">
              {createError}
            </p>
          )}
        </form>
      )}

      <div className="saba-note-tag-options" aria-label="选择 Tag">
        {filteredTags.map((tag) => {
          const selected = value.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              className={
                selected
                  ? "saba-note-tag-option saba-note-tag-option-selected"
                  : "saba-note-tag-option"
              }
              aria-pressed={selected}
              onClick={() => toggle(tag.id)}
            >
              {selected && <span aria-hidden="true">✓</span>}
              #{tag.name}
            </button>
          );
        })}
      </div>

      {filteredTags.length === 0 && (
        <p className="text-sm text-soft">
          {tags.length === 0
            ? "暂无可用 Tag，可以不添加直接保存。"
            : "没有匹配的 Tag。"}
        </p>
      )}
    </div>
  );
}
