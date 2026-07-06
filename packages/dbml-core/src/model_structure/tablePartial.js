import { get } from 'lodash-es';
import Element from './element';

class TablePartial extends Element {
  /**
   * @param {import('../../types/model_structure/tablePartial').RawTablePartial} param0
   */
  constructor ({
    name, note, fields = [], indexes = [], checks = [], token, headerColor, noteToken = null, dbState,
  } = {}) {
    super(token);
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.note = note ? get(note, 'value', note) : null;
    /** @type {import('../../types/model_structure/element').Token} */
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    /** @type {string} */
    this.headerColor = headerColor;
    /** @type {any[]} */
    this.fields = fields;
    /** @type {any[]} */
    this.indexes = indexes;
    /** @type {any[]} */
    this.checks = checks;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = dbState;
    this.generateId();
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('tablePartialId');
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  shallowExport () {
    return {
      name: this.name,
      note: this.note,
      headerColor: this.headerColor,
      fields: this.fields,
      indexes: this.indexes,
    };
  }

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.tablePartials[this.id] = {
      id: this.id,
      ...this.shallowExport(),
    };
  }
}

export default TablePartial;
