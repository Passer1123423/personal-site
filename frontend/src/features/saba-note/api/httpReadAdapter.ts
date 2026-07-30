import type {
  DerivationListParams,
  DerivationView,
  SabaNoteLookups,
} from "../types";
import { buildDerivationView } from "../utils/derivation";
import type { SabaNoteReadAdapter } from "./mockAdapter";
import { httpSabaNoteApi } from "./httpApi";

async function loadViews(
  params?: DerivationListParams,
): Promise<DerivationView[]> {
  const [derivations, nodes, categories] = await Promise.all([
    httpSabaNoteApi.derivations.list(params),
    httpSabaNoteApi.nodes.list(),
    httpSabaNoteApi.categories.list(),
  ]);
  const tagLists = await Promise.all(
    derivations.map((item) =>
      httpSabaNoteApi.graph.getDerivationTags(item.id),
    ),
  );

  return derivations.map((item, index) =>
    buildDerivationView(item, nodes, categories, tagLists[index]),
  );
}

export const httpSabaNoteReadAdapter: SabaNoteReadAdapter = {
  listDerivations: loadViews,
  async getDerivation(id) {
    const [derivation, nodes, categories, tags] = await Promise.all([
      httpSabaNoteApi.derivations.get(id),
      httpSabaNoteApi.nodes.list(),
      httpSabaNoteApi.categories.list(),
      httpSabaNoteApi.graph.getDerivationTags(id),
    ]);

    return buildDerivationView(derivation, nodes, categories, tags);
  },
  async getLookups(): Promise<SabaNoteLookups> {
    const [categories, nodes, tags] = await Promise.all([
      httpSabaNoteApi.categories.list(),
      httpSabaNoteApi.nodes.list(),
      httpSabaNoteApi.graph.listTags(),
    ]);
    return { categories, nodes, tags };
  },
  listRelations: (nodeId) =>
    httpSabaNoteApi.graph.listRelations(
      nodeId ? { nodeId } : undefined,
    ),
};
