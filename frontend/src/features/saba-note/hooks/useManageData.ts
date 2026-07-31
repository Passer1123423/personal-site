import { useCallback, useEffect, useState } from "react";

import { httpSabaNoteApi } from "../api";
import type {
  Category,
  DerivationView,
  KnowledgeNode,
  NodeRelation,
  Tag,
} from "../types";
import { buildDerivationView } from "../utils/derivation";

export type SabaNoteManageData = {
  categories: Category[];
  nodes: KnowledgeNode[];
  tags: Tag[];
  relations: NodeRelation[];
  derivations: DerivationView[];
};

const EMPTY_DATA: SabaNoteManageData = {
  categories: [],
  nodes: [],
  tags: [],
  relations: [],
  derivations: [],
};

async function loadManageData(): Promise<SabaNoteManageData> {
  const [categories, nodes, tags, relations, derivations] = await Promise.all([
    httpSabaNoteApi.categories.list(),
    httpSabaNoteApi.nodes.list(),
    httpSabaNoteApi.graph.listTags(),
    httpSabaNoteApi.graph.listRelations(),
    httpSabaNoteApi.derivations.list(),
  ]);
  const derivationTags = await Promise.all(
    derivations.map((item) =>
      httpSabaNoteApi.graph.getDerivationTags(item.id),
    ),
  );

  return {
    categories,
    nodes,
    tags,
    relations,
    derivations: derivations.map((item, index) =>
      buildDerivationView(item, nodes, categories, derivationTags[index]),
    ),
  };
}

export default function useManageData() {
  const [data, setData] = useState<SabaNoteManageData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;

    void loadManageData()
      .then((nextData) => {
        if (active) setData(nextData);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "知识工作台加载失败",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [revision]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setRevision((current) => current + 1);
  }, []);

  return { data, loading, error, reload };
}
