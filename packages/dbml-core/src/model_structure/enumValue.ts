import { get } from 'lodash-es';
import Element, { Token, RawNote } from './element';
import Enum from './enum';
import DbState from './dbState';
import { NormalizedModel } from './database';

interface RawEnumValue {
  name: string;
  token: Token;
  note: RawNote;
  _enum: Enum;
  noteToken?: Token | null;
}

export interface NormalizedEnumValue {
  id: number;
  name: string;
  note: string | null;
  enumId: number;
}

export interface NormalizedEnumValueIdMap {
  [_id: number]: NormalizedEnumValue;
}

class EnumValue extends Element {
  name: string;
  note: string;
  noteToken: Token;
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
    this.note = (note ? get(note, 'value', note) : null) as string;
    this.noteToken = (note ? get(note, 'token', noteToken) : null) as Token;
    this._enum = _enum;
    this.dbState = this._enum.dbState;
    this.generateId();
  }

  generateId (): void {
    this.id = this.dbState.generateId('enumValueId');
  }

  export (): { name: string; note: string } {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds (): { enumId: number } {
    return {
      enumId: this._enum.id,
    };
  }

  shallowExport (): { name: string; note: string } {
    return {
      name: this.name,
      note: this.note,
    };
  }

  normalize (model: NormalizedModel): void {
    model.enumValues[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default EnumValue;
