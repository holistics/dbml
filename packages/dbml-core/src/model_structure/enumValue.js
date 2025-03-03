import { get } from 'lodash';
import Element from './element';

class EnumValue extends Element {
  constructor ({
    name, token, note, _enum, noteToken = null,
  } = {}) {
    super(token);
    if (!name) { this.error('Enum value must have a name'); }
    this.name = name;
    this.note = note ? get(note, 'value', note) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this._enum = _enum;
    this.dbState = this._enum.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('enumValueId');
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds () {
    return {
      enumId: this._enum.id,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      note: this.note,
    };
  }

  normalize (model) {
    model.enumValues[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default EnumValue;
