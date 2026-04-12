import { get } from 'lodash-es';
import Table from './table';
import Element, { Token, RawNote } from './element';
import Enum from './enum';
import { shouldPrintSchema } from './utils';
import TableGroup from './tableGroup';
import Ref from './ref';
import Database from './database';
import DbState from './dbState';

export interface RawSchema {
  name: string;
  alias?: string;
  note?: RawNote;
  tables?: any[];
  refs?: any[];
  enums?: any[];
  tableGroups?: any[];
  token?: Token;
  database: Database;
  noteToken?: Token | null;
}

class Schema extends Element {
  tables: Table[];
  enums: Enum[];
  tableGroups: TableGroup[];
  refs: Ref[];
  name: string;
  note: string | null;
  noteToken: Token | null;
  alias: string;
  database: Database;
  dbState: DbState;

  constructor ({
    name, alias, note, tables = [], refs = [], enums = [], tableGroups = [], token, database = {} as Database, noteToken = null,
  }: RawSchema) {
    super(token!);
    this.tables = [];
    this.enums = [];
    this.tableGroups = [];
    this.refs = [];
    this.name = name;
    this.note = note ? get(note, 'value', note) as string : null;
    this.noteToken = note ? get(note as RawNote, 'token', noteToken) : null;
    this.alias = alias!;
    this.database = database;
    this.dbState = this.database.dbState;
    this.generateId();

    this.processEnums(enums);
    this.processTables(tables);
    this.processRefs(refs);
    this.processTableGroups(tableGroups);
  }

  generateId () {
    this.id = this.dbState.generateId('schemaId');
  }

  processTables (rawTables: any[]) {
    rawTables.forEach((table) => {
      this.pushTable(new Table({ ...table, schema: this }));
    });
  }

  pushTable (table: Table) {
    this.checkTable(table);
    this.tables.push(table);
  }

  checkTable (table: Table) {
    if (this.tables.some((t) => t.name === table.name)) {
      table.error(`Table ${shouldPrintSchema(this) ? `"${this.name}".` : ''}"${table.name}" existed`);
    }
  }

  findTable (tableName: string): Table | undefined {
    return this.tables.find((t) => t.name === tableName);
  }

  processEnums (rawEnums: any[]) {
    rawEnums.forEach((_enum) => {
      this.pushEnum(new Enum({ ..._enum, schema: this }));
    });
  }

  pushEnum (_enum: Enum) {
    this.checkEnum(_enum);
    this.enums.push(_enum);
  }

  checkEnum (_enum: Enum) {
    if (this.enums.some((e) => e.name === _enum.name)) {
      _enum.error(`Enum ${shouldPrintSchema(this)
        ? `"${this.name}".`
        : ''}"${_enum.name}" existed`);
    }
  }

  processRefs (rawRefs: any[]) {
    rawRefs.forEach((ref) => {
      this.pushRef(new Ref({ ...ref, schema: this }));
    });
  }

  pushRef (ref: Ref) {
    this.checkRef(ref);
    this.refs.push(ref);
  }

  checkRef (ref: Ref) {
    if (this.refs.some((r) => r.equals(ref))) {
      const endpoint1 = ref.endpoints[0];
      const fieldList1 = endpoint1.fieldNames.map((f: string) => JSON.stringify(f)).join(', ');
      const endpoint2 = ref.endpoints[1];
      const fieldList2 = endpoint2.fieldNames.map((f: string) => JSON.stringify(f)).join(', ');
      const ref1 = `"${endpoint1.schemaName ? `${endpoint1.schemaName}"."` : ''}${endpoint1.tableName}"(${fieldList1})`;
      const ref2 = `"${endpoint2.schemaName ? `${endpoint2.schemaName}"."` : ''}${endpoint2.tableName}"(${fieldList2})`;
      ref.error(`Reference with the same endpoints already exists: ${ref1} references ${ref2}`);
    }
  }

  processTableGroups (rawTableGroups: any[]) {
    rawTableGroups.forEach((tableGroup) => {
      this.pushTableGroup(new TableGroup({ ...tableGroup, schema: this }));
    });
  }

  pushTableGroup (tableGroup: TableGroup) {
    this.checkTableGroup(tableGroup);
    this.tableGroups.push(tableGroup);
  }

  checkTableGroup (tableGroup: TableGroup) {
    if (this.tableGroups.some((tg) => tg.name === tableGroup.name)) {
      tableGroup.error(`Table Group ${shouldPrintSchema(this) ? `"${this.name}".` : ''}"${tableGroup.name}" existed`);
    }
  }

  checkSameId (schema: any): boolean {
    return this.name === schema.name
      || this.alias === schema.name
      || this.name === schema.alias
      || !!(this.alias && this.alias === schema.alias);
  }

  export () {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  exportChild () {
    return {
      tables: this.tables.map((t) => t.export()),
      enums: this.enums.map((e) => e.export()),
      tableGroups: this.tableGroups.map((tg) => tg.export()),
      refs: this.refs.map((r) => r.export()),
    };
  }

  exportChildIds () {
    return {
      tableIds: this.tables.map((t) => t.id),
      enumIds: this.enums.map((e) => e.id),
      tableGroupIds: this.tableGroups.map((tg) => tg.id),
      refIds: this.refs.map((r) => r.id),
    };
  }

  exportParentIds () {
    return {
      databaseId: this.database.id,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      note: this.note,
      alias: this.alias,
    };
  }

  normalize (model: any) {
    model.schemas[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.tables.forEach((table) => table.normalize(model));
    this.enums.forEach((_enum) => _enum.normalize(model));
    this.tableGroups.forEach((tableGroup) => tableGroup.normalize(model));
    this.refs.forEach((ref) => ref.normalize(model));
  }
}

export default Schema;
