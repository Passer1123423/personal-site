export type IsoDateTime = string;

export type DerivationStatus =
  | "draft"
  | "verified"
  | "failed"
  | "misconception";

export type Category = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type KnowledgeNode = {
  id: string;
  title: string;
  summary: string;
  categoryId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Derivation = {
  id: string;
  nodeId: string | null;
  title: string;
  contentMd: string;
  status: DerivationStatus;
  isDiscarded: boolean;
  discardedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Tag = {
  id: string;
  name: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type NodeRelation = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  note: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type ContentLinkTargetType = "node" | "derivation";

export type ContentLink = {
  id: string;
  sourceDerivationId: string;
  targetType: ContentLinkTargetType;
  targetId: string;
  createdAt: IsoDateTime;
};

export type MessageResponse = {
  message: string;
};

export type CategoryCreate = {
  name: string;
  parentId?: string | null;
};

export type NodeCreate = {
  title: string;
  categoryId?: string | null;
  summary?: string;
};

export type DerivationCreate = {
  title?: string;
  contentMd?: string;
  nodeId?: string | null;
};

export type RelationCreate = {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  note?: string;
};

export type RelationUpdate = {
  relationType: string;
  note?: string;
};

export type DerivationListParams = {
  nodeId?: string;
  unassigned?: boolean;
  discarded?: boolean;
};

export type NodeListParams = {
  categoryId?: string;
  uncategorized?: boolean;
};

export type RelationListParams = {
  nodeId?: string;
};

export type BacklinkListParams = {
  targetType: ContentLinkTargetType;
  targetId: string;
};

export type DerivationView = {
  derivation: Derivation;
  node: KnowledgeNode | null;
  category: Category | null;
  tags: Tag[];
  excerpt: string;
};

export type SabaNoteDraft = Pick<
  Derivation,
  "title" | "contentMd" | "status" | "nodeId"
> & {
  tagIds: string[];
};

export type SabaNoteLookups = {
  categories: Category[];
  nodes: KnowledgeNode[];
  tags: Tag[];
};

export type DraftSaveStatus = "saved" | "dirty" | "saving";

export type MobileWorkspacePanel = "edit" | "preview" | "info";
