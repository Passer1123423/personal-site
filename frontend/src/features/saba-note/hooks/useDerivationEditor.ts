import { useRef, useState } from "react";

import { httpSabaNoteApi } from "../api";
import type {
  DerivationView,
  SabaNoteDraft,
} from "../types";

export type BackendSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error";

export default function useDerivationEditor(
  source: DerivationView | null,
) {
  const derivationIdRef = useRef(source?.derivation.id ?? null);
  const tagIdsRef = useRef(
    new Set(source?.tags.map((tag) => tag.id) ?? []),
  );
  const [saveStatus, setSaveStatus] =
    useState<BackendSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function save(draft: SabaNoteDraft) {
    setSaveStatus("saving");
    setError(null);

    try {
      let derivationId = derivationIdRef.current;

      if (!derivationId) {
        const created = await httpSabaNoteApi.derivations.create({
          title: draft.title,
          contentMd: draft.contentMd,
          nodeId: draft.nodeId,
        });
        derivationId = created.id;
        derivationIdRef.current = created.id;
      } else {
        await httpSabaNoteApi.derivations.updateTitle(
          derivationId,
          draft.title,
        );
        await httpSabaNoteApi.derivations.updateContent(
          derivationId,
          draft.contentMd,
        );
        await httpSabaNoteApi.derivations.updateNode(
          derivationId,
          draft.nodeId,
        );
      }

      await httpSabaNoteApi.derivations.updateStatus(
        derivationId,
        draft.status,
      );

      const nextTagIds = new Set(draft.tagIds);

      for (const tagId of draft.tagIds) {
        if (!tagIdsRef.current.has(tagId)) {
          await httpSabaNoteApi.graph.addDerivationTag(
            derivationId,
            tagId,
          );
        }
      }
      for (const tagId of tagIdsRef.current) {
        if (!nextTagIds.has(tagId)) {
          await httpSabaNoteApi.graph.removeDerivationTag(
            derivationId,
            tagId,
          );
        }
      }
      tagIdsRef.current = nextTagIds;

      setSaveStatus("saved");
      setSavedAt(new Date());
      return derivationId;
    } catch (reason) {
      setSaveStatus("error");
      setError(
        reason instanceof Error ? reason.message : "保存 Derivation 失败",
      );
      throw reason;
    }
  }

  return { save, saveStatus, savedAt, error };
}
