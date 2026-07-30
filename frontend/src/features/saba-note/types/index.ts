export type DerivationStatus = string;

export type SabaNoteCategory = {
  id: string;
  name: string;
};

export type SabaNoteNode = {
  id: string;
  title: string;
  categoryId: string;
};

export type SabaNoteTag = {
  id: string;
  name: string;
};

export type SabaNoteDerivation = {
  id: string;
  title: string;
  summary: string;
  contentMd: string;
  status: DerivationStatus;
  categoryId: string;
  nodeId: string;
  tagIds: string[];
  updatedAt: string;
};

export type SabaNoteDraft = Pick<
  SabaNoteDerivation,
  "title" | "summary" | "contentMd" | "status" | "nodeId" | "tagIds"
>;

export type DraftSaveStatus = "saved" | "dirty" | "saving";

export type MobileWorkspacePanel = "edit" | "preview" | "info";
