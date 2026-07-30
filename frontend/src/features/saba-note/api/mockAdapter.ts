import {
  mockCategories,
  mockDerivations,
  mockDerivationTagLinks,
  mockNodes,
  mockRelations,
  mockTags,
} from "../data/mockData";
import type {
  Derivation,
  DerivationListParams,
  DerivationView,
  NodeRelation,
  SabaNoteLookups,
} from "../types";
import { buildDerivationView } from "../utils/derivation";

export type SabaNoteReadAdapter = {
  listDerivations(params?: DerivationListParams): Promise<DerivationView[]>;
  getDerivation(id: string): Promise<DerivationView | null>;
  getLookups(): Promise<SabaNoteLookups>;
  listRelations(nodeId?: string): Promise<NodeRelation[]>;
};

function toView(derivation: Derivation): DerivationView {
  const tagIds = mockDerivationTagLinks[derivation.id] ?? [];

  return buildDerivationView(
    derivation,
    mockNodes,
    mockCategories,
    mockTags.filter((item) => tagIds.includes(item.id)),
  );
}

export const mockSabaNoteReadAdapter: SabaNoteReadAdapter = {
  async listDerivations(params = {}) {
    return mockDerivations
      .filter((item) =>
        params.discarded ? item.isDiscarded : !item.isDiscarded,
      )
      .sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      )
      .map(toView);
  },
  async getDerivation(id) {
    const derivation = mockDerivations.find((item) => item.id === id);
    return derivation ? toView(derivation) : null;
  },
  async getLookups() {
    return {
      categories: mockCategories,
      nodes: mockNodes,
      tags: mockTags,
    };
  },
  async listRelations(nodeId) {
    return nodeId
      ? mockRelations.filter(
          (item) =>
            item.sourceNodeId === nodeId || item.targetNodeId === nodeId,
        )
      : mockRelations;
  },
};
