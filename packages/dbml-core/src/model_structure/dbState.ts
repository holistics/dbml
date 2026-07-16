export default class DbState {
  dbId = 1;
  schemaId = 1;
  enumId = 1;
  tableGroupId = 1;
  refId = 1;
  depId = 1;
  depEdgeId = 1;
  tableId = 1;
  noteId = 1;
  enumValueId = 1;
  endpointId = 1;
  indexId = 1;
  checkId = 1;
  fieldId = 1;
  indexColumnId = 1;
  recordId = 1;
  tablePartialId = 1;

  generateId (el: keyof DbState): number {
    const id = this[el] as number;
    (this[el] as number) += 1;
    return id;
  }
}
