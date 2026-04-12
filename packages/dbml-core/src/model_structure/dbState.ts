export default class DbState {
  dbId: number;
  schemaId: number;
  enumId: number;
  tableGroupId: number;
  refId: number;
  tableId: number;
  noteId: number;
  enumValueId: number;
  endpointId: number;
  indexId: number;
  checkId: number;
  fieldId: number;
  indexColumnId: number;
  recordId: number;
  tablePartialId: number;

  constructor () {
    this.dbId = 1;
    this.schemaId = 1;
    this.enumId = 1;
    this.tableGroupId = 1;
    this.refId = 1;
    this.tableId = 1;
    this.noteId = 1;
    this.enumValueId = 1;
    this.endpointId = 1;
    this.indexId = 1;
    this.checkId = 1;
    this.fieldId = 1;
    this.indexColumnId = 1;
    this.recordId = 1;
    this.tablePartialId = 1;
  }

  generateId (el: string): number {
    const id = (this as any)[el] as number;
    (this as any)[el] += 1;
    return id;
  }
}
