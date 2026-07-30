import type {
  BacklinkListParams,
  Category,
  CategoryCreate,
  ContentLink,
  Derivation,
  DerivationCreate,
  DerivationListParams,
  DerivationStatus,
  MessageResponse,
  NodeCreate,
  NodeListParams,
  NodeRelation,
  KnowledgeNode,
  RelationCreate,
  RelationListParams,
  RelationUpdate,
  Tag,
} from "../types";

export type SabaNoteApi = {
  categories: {
    list(): Promise<Category[]>;
    create(payload: CategoryCreate): Promise<Category>;
    rename(id: string, name: string): Promise<Category>;
    deleteEmpty(id: string): Promise<MessageResponse>;
    deleteTree(id: string): Promise<MessageResponse>;
  };
  nodes: {
    list(params?: NodeListParams): Promise<KnowledgeNode[]>;
    get(id: string): Promise<KnowledgeNode>;
    create(payload: NodeCreate): Promise<KnowledgeNode>;
    updateCategory(id: string, categoryId: string | null): Promise<KnowledgeNode>;
    updateTitle(id: string, title: string): Promise<KnowledgeNode>;
    updateSummary(id: string, summary: string): Promise<KnowledgeNode>;
    deleteEmpty(id: string): Promise<MessageResponse>;
    deleteAndDetachDerivations(id: string): Promise<MessageResponse>;
  };
  derivations: {
    list(params?: DerivationListParams): Promise<Derivation[]>;
    get(id: string): Promise<Derivation>;
    create(payload: DerivationCreate): Promise<Derivation>;
    updateTitle(id: string, title: string): Promise<Derivation>;
    updateContent(id: string, contentMd: string): Promise<Derivation>;
    updateNode(id: string, nodeId: string | null): Promise<Derivation>;
    updateStatus(id: string, status: DerivationStatus): Promise<Derivation>;
    discard(id: string): Promise<Derivation>;
    restore(id: string): Promise<Derivation>;
    purge(id: string): Promise<MessageResponse>;
  };
  graph: {
    listTags(): Promise<Tag[]>;
    createTag(name: string): Promise<Tag>;
    renameTag(id: string, name: string): Promise<Tag>;
    deleteEmptyTag(id: string): Promise<MessageResponse>;
    deleteTagWithLinks(id: string): Promise<MessageResponse>;
    getNodeTags(nodeId: string): Promise<Tag[]>;
    addNodeTag(nodeId: string, tagId: string): Promise<MessageResponse>;
    removeNodeTag(nodeId: string, tagId: string): Promise<MessageResponse>;
    getDerivationTags(derivationId: string): Promise<Tag[]>;
    addDerivationTag(derivationId: string, tagId: string): Promise<MessageResponse>;
    removeDerivationTag(derivationId: string, tagId: string): Promise<MessageResponse>;
    getTagNodes(tagId: string): Promise<KnowledgeNode[]>;
    getTagDerivations(tagId: string): Promise<Derivation[]>;
    listRelations(params?: RelationListParams): Promise<NodeRelation[]>;
    createRelation(payload: RelationCreate): Promise<NodeRelation>;
    updateRelation(id: string, payload: RelationUpdate): Promise<NodeRelation>;
    deleteRelation(id: string): Promise<MessageResponse>;
    listBacklinks(params: BacklinkListParams): Promise<ContentLink[]>;
  };
};
