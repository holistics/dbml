export { renameTable } from './renameTable';
export { updateElementSetting } from './updateElementSetting';
export {
  syncDiagramView,
  findDiagramViewBlocks,
  type DiagramViewSyncOperation,
  type DiagramViewBlock,
} from './syncDiagramView';
export {
  syncDep,
  findDepBlocks,
  generateDepBlock,
  type DepSyncOperation,
  type DepSyncEdge,
  type DepEndpointRef,
  type DepBlock,
} from './syncDep';
export { applyTextEdits, type TextEdit } from './applyTextEdits';
export type {
  ElementIdentifier,
  SchemaIdentifier,
  TableIdentifier,
  ColumnIdentifier,
  EnumIdentifier,
  EndpointRef,
  RefIdentifier,
  DepIdentifier,
  NoteIdentifier,
  TableGroupIdentifier,
} from './types';
