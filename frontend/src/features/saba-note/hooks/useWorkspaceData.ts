import { useEffect, useState } from "react";

import { sabaNoteReadAdapter } from "../api";
import type {
  DerivationView,
  SabaNoteLookups,
} from "../types";

const EMPTY_LOOKUPS: SabaNoteLookups = {
  categories: [],
  nodes: [],
  tags: [],
};

export default function useWorkspaceData(id: string | null) {
  const [derivation, setDerivation] = useState<DerivationView | null>(null);
  const [lookups, setLookups] = useState<SabaNoteLookups>(EMPTY_LOOKUPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      id ? sabaNoteReadAdapter.getDerivation(id) : Promise.resolve(null),
      sabaNoteReadAdapter.getLookups(),
    ])
      .then(([nextDerivation, nextLookups]) => {
        if (!active) return;
        setDerivation(nextDerivation);
        setLookups(nextLookups);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "工作台数据加载失败");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  return { derivation, lookups, loading, error };
}
