import { useState } from "react";

import { httpSabaNoteApi } from "../api";

export default function useDerivationActions() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<unknown>) {
    setPendingId(id);
    setError(null);
    try {
      await action();
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Derivation 操作失败";
      setError(message);
      throw reason;
    } finally {
      setPendingId(null);
    }
  }

  return {
    pendingId,
    error,
    discard: (id: string) =>
      run(id, () => httpSabaNoteApi.derivations.discard(id)),
    restore: (id: string) =>
      run(id, () => httpSabaNoteApi.derivations.restore(id)),
    purge: (id: string) =>
      run(id, () => httpSabaNoteApi.derivations.purge(id)),
  };
}
