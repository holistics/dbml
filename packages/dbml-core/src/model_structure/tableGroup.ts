import { get } from 'lodash-es';
import Element, { RawNote, Token } from './element';
import Schema from './schema';
import Table from './table';
import DbState from './dbState';
import { NormalizedModel } from './database';
import { shouldPrintSchema } from './utils';

interface RawTableGroup {
  name: string;
  tables: Table[];
  schema: Schema;
  token: Token;
  note: RawNote;
  color: string;
  noteToken?: Token | null;
}

export interface NormalizedTableGroup {
  id: number;
  name: string;
  note: string | null;
  color: string;
  tableIds: number[];
  schemaId: number;
}

export interface NormalizedTableGroupIdMap {
  [_id: number]: NormalizedTableGroup;
}

class TableGroup extends Element {
  name: string;
  tables: Table[];
  schema: Schema;
  dbState: DbState;
  note: string;
  noteToken: Token;
  color: string;

  constructor ({
    name, token, tables = [], schema = {} as Schema, note, color, noteToken = null,
  }: RawTableGroup) {
    super(token);
    this.name = name;
    this.tables = [];
    this.schema = schema;
    this.dbState = this.schema.dbState;
    this.note = (note ? get(note, 'value', note) : null) as string;
    this.noteToken = (note ? get(note, 'token', noteToken) : null) as Token;
    this.color = color;
    this.generateId();

    this.processTables(tables);
  }

  generateId (): void {
    this.id = this.dbState.generateId('tableGroupId');
  }

  processTables (rawTables: any): void {
    rawTables.forEach((rawTable: any) => {
      const table = this.schema.database.findTable(rawTable.schemaName, rawTable.name);
      if (!table) {
        this.error(`Table ${rawTable.schemaName ? `"${rawTable.schemaName}".` : ''}${rawTable.name} don't exist`);
      }
      this.pushTable(table);
    });
  }

  pushTable (table: any): void {
    this.checkTable(table);
    this.tables.push(table);
    table.group = this;
  }

  checkTable (table: any): void {
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

  exportChild (): { tables: { tableName: string; schemaName: string }[] } {
    return {
      tables: this.tables.map((t) => ({ tableName: t.name, schemaName: t.schema.name })),
    };
  }

  exportChildIds (): { tableIds: number[] } {
    return {
      tableIds: this.tables.map((t) => t.id),
    };
  }

  exportParentIds (): { schemaId: number } {
    return {
      schemaId: this.schema.id,
    };
  }

  shallowExport (): { name: string; note: string; color: string } {
    return {
      name: this.name,
      note: this.note,
      color: this.color,
    };
  }

  normalize (model: NormalizedModel): void {
    model.tableGroups[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };
  }
}

export default TableGroup;
