import { get } from 'lodash-es';
import Element, { RawNote, Token } from './element';
import Field from './field';
import Index from './indexes';
import Check from './check';
import DbState from './dbState';
import { NormalizedModel } from './database';

interface RawTablePartial {
  name: string;
  note: RawNote;
  fields: Field[];
  indexes: Index[];
  checks?: any[];
  token: Token;
  headerColor: string;
  dbState: DbState;
}

export interface NormalizedTablePartial {
  id: number;
  name: string;
  note: string;
  headerColor: string;
  fieldIds: number[];
  indexIds: number[];
  checkIds: number[];
}

export interface NormalizedTablePartialIdMap {
  [id: number]: NormalizedTablePartial;
}

class TablePartial extends Element {
  name: string;
  note: string;
  noteToken: Token;
  fields: Field[];
  indexes: Index[];
  checks: Check[];
  headerColor: string;
  dbState: DbState;

  constructor ({
    name, note, fields = [], indexes = [], checks = [], token, headerColor, noteToken = null, dbState,
  }: RawTablePartial & { noteToken?: Token | null }) {
    super(token);
    this.name = name;
    this.note = (note ? get(note, 'value', note) : null) as string;
    this.noteToken = (note ? get(note, 'token', noteToken) : null) as Token;
    this.headerColor = headerColor;
    this.fields = fields as Field[];
    this.indexes = indexes as Index[];
    this.checks = checks as Check[];
    this.dbState = dbState;
    this.generateId();
  }

  generateId (): void {
    this.id = this.dbState.generateId('tablePartialId');
  }

  export (): ReturnType<TablePartial['shallowExport']> {
    return {
      ...this.shallowExport(),
    };
  }

  shallowExport (): {
    name: string;
    note: string;
    headerColor: string;
    fields: Field[];
    indexes: Index[];
  } {
    return {
      name: this.name,
      note: this.note,
      headerColor: this.headerColor,
      fields: this.fields,
      indexes: this.indexes,
    };
  }

  normalize (model: NormalizedModel): void {
    model.tablePartials[this.id] = {
      id: this.id,
      name: this.name,
      note: this.note,
      headerColor: this.headerColor,
      fieldIds: (this.fields as any[]).map((f: any) => f.id).filter(Boolean),
      indexIds: (this.indexes as any[]).map((i: any) => i.id).filter(Boolean),
      checkIds: (this.checks as any[]).map((c: any) => c.id).filter(Boolean),
    };
  }
}

export default TablePartial;
