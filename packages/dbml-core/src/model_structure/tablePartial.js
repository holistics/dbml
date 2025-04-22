import { get } from 'lodash';
import Element from './element';

class TablePartial extends Element {
  constructor ({
    name, note, fields = [], indexes = [], token, headerColor, noteToken = null, dbState
  } = {}) {
    super(token);
    this.name = name;
    this.note = note ? get(note, 'value', note) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this.headerColor = headerColor;
    this.fields = fields;
    this.indexes = indexes;
    this.dbState = dbState;
    this.generateId();
  }

  generateId () {
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

  normalize (model) {
    model.tablePartials[this.id] = {
      id: this.id,
      ...this.shallowExport(),
    };
  }
}

export default TablePartial;
