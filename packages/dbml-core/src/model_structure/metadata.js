import Element from './element';

class Metadata extends Element {
  /**
   * @param {import('../../types/model_structure/metadata').RawMetadata} param0
   */
  constructor ({
    target = {}, values = {}, token, database = {},
  } = {}) {
    super(token);
    /** @type {string} */
    this.targetKind = target.kind;
    /** @type {string[]} */
    this.targetName = target.name || [];
    /** @type {{ [key: string]: unknown }} */
    this.values = values || {};
    /**
     * The resolved target element; set by `Database.processMetadataElements`.
     * @type {import('../../types/model_structure/element').default | null}
     */
    this.target = null;
    /** @type {import('../../types/model_structure/database').default} */
    this.database = database;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = this.database.dbState;
    this.generateId();
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('metadataId');
  }

  export () {
    return {
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }

  shallowExport () {
    return {
      targetKind: this.targetKind,
      targetName: this.targetName,
      values: this.values,
    };
  }

  exportParentIds () {
    return {
      targetId: this.target ? this.target.id : null,
    };
  }

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.metadata[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default Metadata;
