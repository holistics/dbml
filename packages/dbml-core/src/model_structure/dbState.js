export default class DbState {
  constructor () {
    /** @type {number} */
    this.dbId = 1;
    /** @type {number} */
    this.schemaId = 1;
    /** @type {number} */
    this.enumId = 1;
    /** @type {number} */
    this.tableGroupId = 1;
    /** @type {number} */
    this.refId = 1;
    /** @type {number} */
    this.depId = 1;
    /** @type {number} */
    this.tableId = 1;
    /** @type {number} */
    this.noteId = 1;
    /** @type {number} */
    this.enumValueId = 1;
    /** @type {number} */
    this.endpointId = 1;
    /** @type {number} */
    this.indexId = 1;
    /** @type {number} */
    this.checkId = 1;
    /** @type {number} */
    this.fieldId = 1;
    /** @type {number} */
    this.indexColumnId = 1;
    /** @type {number} */
    this.recordId = 1;
    /** @type {number} */
    this.tablePartialId = 1;
  }

  /**
   * @param {string} el
   * @returns {number}
   */
  generateId (el) {
    const id = this[el];
    this[el] += 1;
    return id;
  }
}
