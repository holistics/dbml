import Element from './element';

class IndexColumn extends Element {
  /**
   * @param {import('../../types/model_structure/indexColumn').RawIndexColumn} param0
   */
  constructor ({
    type, value, index, token,
  }) {
    super();
    /** @type {string} */
    this.type = type;
    /** @type {string} */
    this.value = value;
    /** @type {import('../../types/model_structure/indexes').default} */
    this.index = index;
    /** @type {import('../../types/model_structure/element').Token} */
    this.token = token;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = this.index.dbState;
    this.generateId();
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('indexColumnId');
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds () {
    return {
      indexId: this.index.id,
    };
  }

  shallowExport () {
    return {
      type: this.type,
      value: this.value,
    };
  }

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.indexColumns[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default IndexColumn;
