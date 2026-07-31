import { useEffect, useMemo, useRef, useState } from "react";

import type {
  DraftSaveStatus,
  SabaNoteDraft,
} from "../types";

function serializeBackendDraft(draft: SabaNoteDraft) {
  return JSON.stringify({
    title: draft.title.trim(),
    contentMd: draft.contentMd,
    status: draft.status,
    nodeId: draft.nodeId,
    tagIds: [...draft.tagIds].sort(),
  });
}

function readCachedDraft(storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SabaNoteDraft) : null;
  } catch {
    return null;
  }
}

export default function useSabaNoteDraft(
  draftId: string,
  initialDraft: SabaNoteDraft,
) {
  const storageKey = useMemo(() => `saba-note:draft:${draftId}`, [draftId]);
  const [draft, setDraft] = useState<SabaNoteDraft>(initialDraft);
  const [cachedDraft, setCachedDraft] = useState<SabaNoteDraft | null>(
    () => readCachedDraft(storageKey),
  );
  const [saveStatus, setSaveStatus] =
    useState<DraftSaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const hasEditedRef = useRef(false);
  const [backendDraft, setBackendDraft] = useState(() =>
    serializeBackendDraft(initialDraft),
  );

  const isDirty = useMemo(
    () => serializeBackendDraft(draft) !== backendDraft,
    [backendDraft, draft],
  );

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
    const nextDraft = { ...draft, [key]: value };
    if (JSON.stringify(nextDraft) === JSON.stringify(draft)) {
      return;
    }

    const nextIsDirty = serializeBackendDraft(nextDraft) !== backendDraft;

    if (!nextIsDirty) {
      localStorage.removeItem(storageKey);
      hasEditedRef.current = false;
      setCachedDraft(null);
    } else {
      hasEditedRef.current = true;
    }

    setDraft(nextDraft);
    setSaveStatus(nextIsDirty ? "dirty" : "saved");
  }

  function clearCachedDraft() {
    localStorage.removeItem(storageKey);
    hasEditedRef.current = false;
    setCachedDraft(null);
    setSaveStatus(isDirty ? "dirty" : "saved");
  }

  function restoreCachedDraft() {
    if (!cachedDraft) return;
    const nextIsDirty = serializeBackendDraft(cachedDraft) !== backendDraft;
    hasEditedRef.current = nextIsDirty;
    setDraft(cachedDraft);
    setCachedDraft(null);
    setSaveStatus(nextIsDirty ? "dirty" : "saved");
  }

  function markBackendSaved(savedDraft: SabaNoteDraft) {
    localStorage.removeItem(storageKey);
    hasEditedRef.current = false;
    setCachedDraft(null);
    setBackendDraft(serializeBackendDraft(savedDraft));
    setSaveStatus("saved");
  }

  return {
    draft,
    cachedDraft,
    saveStatus,
    savedAt,
    isDirty,
    update,
    clearCachedDraft,
    restoreCachedDraft,
    markBackendSaved,
  };
}
