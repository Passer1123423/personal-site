import { useEffect, useState } from "react";

import { httpSabaNoteApi } from "../api";
import type { ContentLink } from "../types";

export default function useDerivationBacklinks(
  derivationId: string | undefined,
) {
  const [data, setData] = useState<ContentLink[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!derivationId) return;

    void httpSabaNoteApi.graph
      .listBacklinks({
        targetType: "derivation",
        targetId: derivationId,
      })
      .then((items) => {
        if (active) setData(items);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Backlinks 加载失败",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [derivationId]);

  return { data, error };
}
