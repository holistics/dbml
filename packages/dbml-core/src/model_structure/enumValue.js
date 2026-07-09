import { get } from 'lodash-es';
import Element from './element';

class EnumValue extends Element {
  /**
   * @param {import('../../types/model_structure/enumValue').RawEnumValue} param0
   */
  constructor ({
    name, token, note, _enum, noteToken = null,
  } = {}) {
    super(token);
    if (!name) {
      this.error('Enum value must have a name');
    }
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.note = note ? get(note, 'value', note) : null;
    /** @type {import('../../types/model_structure/element').Token} */
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    /** @type {import('../../types/model_structure/enum').default} */
    this._enum = _enum;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = this._enum.dbState;
    this.generateId();
  }

  generateId () {
    /** @type {number} */
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

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.enumValues[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default EnumValue;
