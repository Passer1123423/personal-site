import { useMemo, useState } from "react";

import SearchBox from "../../../components/SearchBox";
import type { Tag } from "../types";

type TagPickerProps = {
  tags: Tag[];
  value: string[];
  onChange: (tagIds: string[]) => void;
};

export default function TagPicker({ tags, value, onChange }: TagPickerProps) {
  const [keyword, setKeyword] = useState("");

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

  return (
    <div className="saba-note-tag-picker">
      <SearchBox
        value={keyword}
        onChange={setKeyword}
        placeholder="查找 Tag"
        className="saba-note-tag-search"
      />

      <div className="flex flex-wrap gap-2">
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
