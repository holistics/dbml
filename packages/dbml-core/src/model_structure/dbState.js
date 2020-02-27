export default class DbState {
  constructor () {
    this.dbId = 1;
    this.schemaId = 1;
    this.enumId = 1;
    this.tableGroupId = 1;
    this.refId = 1;
    this.tableId = 1;
    this.enumValueId = 1;
    this.endpointId = 1;
    this.indexId = 1;
    this.fieldId = 1;
    this.indexColumnId = 1;
  }

  generateId (el) {
    const id = this[el];
    this[el] += 1;
    return id;
  }
}
