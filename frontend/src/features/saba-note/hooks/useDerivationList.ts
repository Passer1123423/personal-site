import { useEffect, useState } from "react";

import { sabaNoteReadAdapter } from "../api";
import type {
  DerivationListParams,
  DerivationView,
} from "../types";

export default function useDerivationList(
  params?: DerivationListParams,
) {
  const [data, setData] = useState<DerivationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const discarded = params?.discarded;

  useEffect(() => {
    let active = true;

    void sabaNoteReadAdapter
      .listDerivations(
        discarded === undefined ? undefined : { discarded },
      )
      .then((items) => {
        if (active) setData(items);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "推导列表加载失败");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [discarded, reloadKey]);

  return {
    data,
    loading,
    error,
    reload: () => {
      setLoading(true);
      setError(null);
      setReloadKey((value) => value + 1);
    },
  };
}
