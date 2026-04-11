import { get } from 'lodash-es';
import Element, { Token, RawNote } from './element';
import Enum from './enum';
import DbState from './dbState';

export interface RawEnumValue {
  name: string;
  token: Token;
  note: RawNote;
  _enum: Enum;
  noteToken?: Token | null;
}

class EnumValue extends Element {
  name: string;
  note: string | null;
  noteToken: Token | null;
  _enum: Enum;
  dbState: DbState;

  constructor ({
    name, token, note, _enum, noteToken = null,
  }: RawEnumValue) {
    super(token);
    if (!name) {
      this.error('Enum value must have a name');
    }
    this.name = name;
    this.note = note ? get(note, 'value', note) as string : null;
    this.noteToken = note ? get(note as RawNote, 'token', noteToken) : null;
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

  normalize (model: any) {
    model.enumValues[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default EnumValue;
