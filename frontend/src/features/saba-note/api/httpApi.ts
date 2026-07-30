import type { SabaNoteApi } from "./contracts";
import { sabaNoteRequest } from "./client";

function queryPath(path: string, values: Record<string, string | boolean | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  return query.size > 0 ? `${path}?${query}` : path;
}

const GRAPH_PATH = "/api/knowledge-graph";

export const httpSabaNoteApi: SabaNoteApi = {
  categories: {
    list: () => sabaNoteRequest("/api/categories"),
    create: (payload) =>
      sabaNoteRequest("/api/categories", { method: "POST", body: payload }),
    rename: (id, name) =>
      sabaNoteRequest(`/api/categories/${encodeURIComponent(id)}/name`, {
        method: "PATCH",
        body: { name },
      }),
    deleteEmpty: (id) =>
      sabaNoteRequest(`/api/categories/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    deleteTree: (id) =>
      sabaNoteRequest(`/api/categories/${encodeURIComponent(id)}/tree`, {
        method: "DELETE",
      }),
  },
  nodes: {
    list: (params = {}) =>
      sabaNoteRequest(
        queryPath("/api/nodes", {
          categoryId: params.categoryId,
          uncategorized: params.uncategorized,
        }),
      ),
    get: (id) => sabaNoteRequest(`/api/nodes/${encodeURIComponent(id)}`),
    create: (payload) =>
      sabaNoteRequest("/api/nodes", { method: "POST", body: payload }),
    updateCategory: (id, categoryId) =>
      sabaNoteRequest(`/api/nodes/${encodeURIComponent(id)}/category`, {
        method: "PATCH",
        body: { categoryId },
      }),
    updateTitle: (id, title) =>
      sabaNoteRequest(`/api/nodes/${encodeURIComponent(id)}/title`, {
        method: "PATCH",
        body: { title },
      }),
    updateSummary: (id, summary) =>
      sabaNoteRequest(`/api/nodes/${encodeURIComponent(id)}/summary`, {
        method: "PATCH",
        body: { summary },
      }),
    deleteEmpty: (id) =>
      sabaNoteRequest(`/api/nodes/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    deleteAndDetachDerivations: (id) =>
      sabaNoteRequest(
        `/api/nodes/${encodeURIComponent(id)}/detach-derivations`,
        { method: "DELETE" },
      ),
  },
  derivations: {
    list: (params = {}) =>
      sabaNoteRequest(
        queryPath("/api/derivations", {
          nodeId: params.nodeId,
          unassigned: params.unassigned,
          discarded: params.discarded,
        }),
      ),
    get: (id) =>
      sabaNoteRequest(`/api/derivations/${encodeURIComponent(id)}`),
    create: (payload) =>
      sabaNoteRequest("/api/derivations", { method: "POST", body: payload }),
    updateTitle: (id, title) =>
      sabaNoteRequest(`/api/derivations/${encodeURIComponent(id)}/title`, {
        method: "PATCH",
        body: { title },
      }),
    updateContent: (id, contentMd) =>
      sabaNoteRequest(`/api/derivations/${encodeURIComponent(id)}/content`, {
        method: "PATCH",
        body: { contentMd },
      }),
    updateNode: (id, nodeId) =>
      sabaNoteRequest(`/api/derivations/${encodeURIComponent(id)}/node`, {
        method: "PATCH",
        body: { nodeId },
      }),
    updateStatus: (id, status) =>
      sabaNoteRequest(`/api/derivations/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: { status },
      }),
    discard: (id) =>
      sabaNoteRequest(`/api/derivations/${encodeURIComponent(id)}/discard`, {
        method: "POST",
      }),
    restore: (id) =>
      sabaNoteRequest(`/api/derivations/${encodeURIComponent(id)}/restore`, {
        method: "POST",
      }),
    purge: (id) =>
      sabaNoteRequest(`/api/derivations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },
  graph: {
    listTags: () => sabaNoteRequest(`${GRAPH_PATH}/tags`),
    createTag: (name) =>
      sabaNoteRequest(`${GRAPH_PATH}/tags`, {
        method: "POST",
        body: { name },
      }),
    renameTag: (id, name) =>
      sabaNoteRequest(`${GRAPH_PATH}/tags/${encodeURIComponent(id)}/name`, {
        method: "PATCH",
        body: { name },
      }),
    deleteEmptyTag: (id) =>
      sabaNoteRequest(`${GRAPH_PATH}/tags/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    deleteTagWithLinks: (id) =>
      sabaNoteRequest(
        `${GRAPH_PATH}/tags/${encodeURIComponent(id)}/with-links`,
        { method: "DELETE" },
      ),
    getNodeTags: (nodeId) =>
      sabaNoteRequest(`${GRAPH_PATH}/nodes/${encodeURIComponent(nodeId)}/tags`),
    addNodeTag: (nodeId, tagId) =>
      sabaNoteRequest(`${GRAPH_PATH}/nodes/${encodeURIComponent(nodeId)}/tags`, {
        method: "POST",
        body: { tagId },
      }),
    removeNodeTag: (nodeId, tagId) =>
      sabaNoteRequest(
        `${GRAPH_PATH}/nodes/${encodeURIComponent(nodeId)}/tags/${encodeURIComponent(tagId)}`,
        { method: "DELETE" },
      ),
    getDerivationTags: (derivationId) =>
      sabaNoteRequest(
        `${GRAPH_PATH}/derivations/${encodeURIComponent(derivationId)}/tags`,
      ),
    addDerivationTag: (derivationId, tagId) =>
      sabaNoteRequest(
        `${GRAPH_PATH}/derivations/${encodeURIComponent(derivationId)}/tags`,
        { method: "POST", body: { tagId } },
      ),
    removeDerivationTag: (derivationId, tagId) =>
      sabaNoteRequest(
        `${GRAPH_PATH}/derivations/${encodeURIComponent(derivationId)}/tags/${encodeURIComponent(tagId)}`,
        { method: "DELETE" },
      ),
    getTagNodes: (tagId) =>
      sabaNoteRequest(`${GRAPH_PATH}/tags/${encodeURIComponent(tagId)}/nodes`),
    getTagDerivations: (tagId) =>
      sabaNoteRequest(
        `${GRAPH_PATH}/tags/${encodeURIComponent(tagId)}/derivations`,
      ),
    listRelations: (params = {}) =>
      sabaNoteRequest(
        queryPath(`${GRAPH_PATH}/relations`, { nodeId: params.nodeId }),
      ),
    createRelation: (payload) =>
      sabaNoteRequest(`${GRAPH_PATH}/relations`, {
        method: "POST",
        body: payload,
      }),
    updateRelation: (id, payload) =>
      sabaNoteRequest(`${GRAPH_PATH}/relations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: payload,
      }),
    deleteRelation: (id) =>
      sabaNoteRequest(`${GRAPH_PATH}/relations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    listBacklinks: (params) =>
      sabaNoteRequest(
        queryPath(`${GRAPH_PATH}/backlinks`, {
          targetType: params.targetType,
          targetId: params.targetId,
        }),
      ),
  },
};
