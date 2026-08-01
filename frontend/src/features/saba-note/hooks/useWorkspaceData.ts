import { useEffect, useState } from "react";

import { httpSabaNoteApi, sabaNoteReadAdapter } from "../api";
import type {
  DerivationView,
  SabaNoteLookups,
} from "../types";
import { buildDerivationView } from "../utils/derivation";

const EMPTY_LOOKUPS: SabaNoteLookups = {
  categories: [],
  nodes: [],
  tags: [],
};

export default function useWorkspaceData(id: string | null) {
  const [derivation, setDerivation] = useState<DerivationView | null>(null);
  const [lookups, setLookups] = useState<SabaNoteLookups>(EMPTY_LOOKUPS);
  const [referenceCandidates, setReferenceCandidates] = useState<
    DerivationView[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      id ? sabaNoteReadAdapter.getDerivation(id) : Promise.resolve(null),
      sabaNoteReadAdapter.getLookups(),
      httpSabaNoteApi.derivations.list(),
    ])
      .then(([nextDerivation, nextLookups, derivations]) => {
        if (!active) return;
        setDerivation(nextDerivation);
        setLookups(nextLookups);
        setReferenceCandidates(
          derivations.map((item) =>
            buildDerivationView(
              item,
              nextLookups.nodes,
              nextLookups.categories,
              [],
            ),
          ),
        );
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

  return { derivation, lookups, referenceCandidates, loading, error };
}
