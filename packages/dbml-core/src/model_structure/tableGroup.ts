import { get } from 'lodash-es';
import Element, { Token, RawNote } from './element';
import { shouldPrintSchema } from './utils';
import Table from './table';
import Schema from './schema';
import DbState from './dbState';

export interface RawTableGroup {
  name: string;
  tables: any[];
  schema: Schema;
  token: Token;
  note: RawNote;
  color: string;
  noteToken?: Token | null;
}

class TableGroup extends Element {
  name: string;
  tables: Table[];
  schema: Schema;
  dbState: DbState;
  note: string | null;
  noteToken: Token | null;
  color: string;

  constructor ({
    name, token, tables = [], schema = {} as Schema, note, color, noteToken = null,
  }: RawTableGroup) {
    super(token);
    this.name = name;
    this.tables = [];
    this.schema = schema;
    this.dbState = this.schema.dbState;
    this.note = note ? get(note, 'value', note) as string : null;
    this.noteToken = note ? get(note as RawNote, 'token', noteToken) : null;
    this.color = color;
    this.generateId();

    this.processTables(tables);
  }

  generateId () {
    this.id = this.dbState.generateId('tableGroupId');
  }

  processTables (rawTables: any[]) {
    rawTables.forEach((rawTable) => {
      const table = this.schema.database.findTable(rawTable.schemaName, rawTable.name);
      if (!table) {
        this.error(`Table ${rawTable.schemaName ? `"${rawTable.schemaName}".` : ''}${rawTable.name} don't exist`);
      }
      this.pushTable(table!);
    });
  }

  pushTable (table: Table) {
    this.checkTable(table);
    this.tables.push(table);
    table.group = this;
  }

  checkTable (table: Table) {
    if (this.tables.some((t) => t.id === table.id)) {
      this.error(`Table ${shouldPrintSchema(table.schema) ? `"${table.schema.name}".` : ''}.${table.name} is already in the group`);
    }

    if (table.group) {
      this.error(`Table ${shouldPrintSchema(table.schema)
        ? `"${table.schema.name}".`
        : ''}.${table.name} is already in group ${shouldPrintSchema(table.group.schema)
        ? `"${table.group.schema.name}".`
        : ''}${table.group.name}`);
    }
  }

  export () {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  exportChild () {
    return {
      tables: this.tables.map((t) => ({ tableName: t.name, schemaName: t.schema.name })),
    };
  }

  exportChildIds () {
    return {
      tableIds: this.tables.map((t) => t.id),
    };
  }

  exportParentIds () {
    return {
      schemaId: this.schema.id,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      note: this.note,
      color: this.color,
    };
  }

  normalize (model: any) {
    model.tableGroups[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };
  }
}

export default TableGroup;
