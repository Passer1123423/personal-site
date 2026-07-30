import { useEffect, useState } from "react";

import { sabaNoteReadAdapter } from "../api";
import type { DerivationView } from "../types";

export default function useDerivationDetail(id: string | undefined) {
  const [data, setData] = useState<DerivationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!id) {
      Promise.resolve().then(() => {
        if (active) {
          setError("缺少 Derivation ID");
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }

    void sabaNoteReadAdapter
      .getDerivation(id)
      .then((item) => {
        if (active) setData(item);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "推导内容加载失败");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  return { data, loading, error };
}
