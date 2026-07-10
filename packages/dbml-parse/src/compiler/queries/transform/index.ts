export { renameTable } from './renameTable';
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
export {
  updateNoteEdit, removeNoteEdit, addNoteEdit,
  updateNote, removeNote, addNote,
} from './note';
export { type TableNameInput } from './utils';
