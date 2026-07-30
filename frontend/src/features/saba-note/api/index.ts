export { httpSabaNoteApi } from "./httpApi";
export type { SabaNoteApi } from "./contracts";

// HTTP 是运行时默认数据源；mock 仅保留给无后端的独立预览环境显式使用。
export {
  httpSabaNoteReadAdapter as sabaNoteReadAdapter,
} from "./httpReadAdapter";
export {
  mockSabaNoteReadAdapter,
  type SabaNoteReadAdapter,
} from "./mockAdapter";
