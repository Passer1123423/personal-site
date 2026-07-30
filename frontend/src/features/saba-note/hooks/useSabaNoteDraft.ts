import { useEffect, useMemo, useRef, useState } from "react";

import type {
  DraftSaveStatus,
  SabaNoteDraft,
} from "../types";

function readCachedDraft(storageKey: string, fallback: SabaNoteDraft) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SabaNoteDraft) : fallback;
  } catch {
    return fallback;
  }
}

export default function useSabaNoteDraft(
  draftId: string,
  initialDraft: SabaNoteDraft,
) {
  const storageKey = useMemo(() => `saba-note:draft:${draftId}`, [draftId]);
  const [draft, setDraft] = useState<SabaNoteDraft>(() =>
    readCachedDraft(storageKey, initialDraft),
  );
  const [saveStatus, setSaveStatus] =
    useState<DraftSaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const hasEditedRef = useRef(false);

  useEffect(() => {
    if (!hasEditedRef.current) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(draft));

    let savedTimer: number | undefined;
    const savingTimer = window.setTimeout(() => {
      setSaveStatus("saving");
      savedTimer = window.setTimeout(() => {
        setSaveStatus("saved");
        setSavedAt(new Date());
        hasEditedRef.current = false;
      }, 260);
    }, 720);

    return () => {
      window.clearTimeout(savingTimer);
      if (savedTimer !== undefined) {
        window.clearTimeout(savedTimer);
      }
    };
  }, [draft, storageKey]);

  function update<K extends keyof SabaNoteDraft>(
    key: K,
    value: SabaNoteDraft[K],
  ) {
    hasEditedRef.current = true;
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveStatus("dirty");
  }

  return { draft, saveStatus, savedAt, update };
}
