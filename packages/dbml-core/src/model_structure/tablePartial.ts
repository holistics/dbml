import { get } from 'lodash-es';
import Element, { Token, RawNote } from './element';
import DbState from './dbState';

export interface RawTablePartial {
  name: string;
  note: RawNote;
  fields?: any[];
  indexes?: any[];
  checks?: any[];
  token: Token;
  headerColor: string;
  dbState: DbState;
  noteToken?: Token | null;
}

class TablePartial extends Element {
  name: string;
  note: string | null;
  noteToken: Token | null;
  headerColor: string;
  fields: any[];
  indexes: any[];
  checks: any[];
  dbState: DbState;

  constructor ({
    name, note, fields = [], indexes = [], checks = [], token, headerColor, noteToken = null, dbState,
  }: RawTablePartial) {
    super(token);
    this.name = name;
    this.note = note ? get(note, 'value', note) as string : null;
    this.noteToken = note ? get(note as RawNote, 'token', noteToken) : null;
    this.headerColor = headerColor;
    this.fields = fields;
    this.indexes = indexes;
    this.checks = checks;
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

  normalize (model: any) {
    model.tablePartials[this.id] = {
      id: this.id,
      ...this.shallowExport(),
    };
  }
}

export default TablePartial;
