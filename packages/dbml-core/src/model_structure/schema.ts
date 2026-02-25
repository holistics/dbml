import { get } from 'lodash-es';
import Table from './table';
import Element, { RawNote, Token } from './element';
import Enum from './enum';
import { shouldPrintSchema } from './utils';
import TableGroup from './tableGroup';
import Ref from './ref';
import Database, { NormalizedModel } from './database';
import DbState from './dbState';

export interface RawSchema {
  name: string;
  alias?: string;
  note?: RawNote;
  tables?: Table[];
  refs?: Ref[];
  enums?: Enum[];
  tableGroups?: TableGroup[];
  token?: Token;
  database: Database;
  noteToken?: Token | null;
}

export interface NormalizedSchema {
  id: number;
  name: string;
  note: string | null;
  alias: string;
  tableIds: number[];
  noteIds: number[];
  refIds: number[];
  tableGroupIds: number[];
  enumIds: number[];
  databaseId: number;
}

export interface NormalizedSchemaIdMap {
  [_id: number]: NormalizedSchema;
}

class Schema extends Element {
  name: string;
  alias: string;
  note: string;
  noteToken: Token;
  tables: Table[];
  refs: Ref[];
  enums: Enum[];
  tableGroups: TableGroup[];
  database: Database;
  dbState: DbState;

  constructor ({
    name, alias, note, tables = [], refs = [], enums = [], tableGroups = [], token, database = {} as Database, noteToken = null,
  }: RawSchema) {
    super(token as Token);
    this.tables = [];
    this.enums = [];
    this.tableGroups = [];
    this.refs = [];
    this.name = name;
    this.note = (note ? get(note, 'value', note) : null) as string;
    this.noteToken = (note ? get(note, 'token', noteToken) : null) as Token;
    this.alias = alias as string;
    this.database = database;
    this.dbState = this.database.dbState;
    this.generateId();

    this.processEnums(enums);
    this.processTables(tables);
    this.processRefs(refs);
    this.processTableGroups(tableGroups);
  }

  generateId (): void {
    this.id = this.dbState.generateId('schemaId');
  }

  processTables (rawTables: any): void {
    rawTables.forEach((table: any) => {
      this.pushTable(new Table({ ...table, schema: this }));
    });
  }

  pushTable (table: any): void {
    this.checkTable(table);
    this.tables.push(table);
  }

  checkTable (table: any): void {
    if (this.tables.some((t) => t.name === table.name)) {
      table.error(`Table ${shouldPrintSchema(this) ? `"${this.name}".` : ''}"${table.name}" existed`);
    }
  }

  findTable (tableName: string): Table | undefined {
    return this.tables.find((t) => t.name === tableName);
  }

  processEnums (rawEnums: any): void {
    rawEnums.forEach((_enum: any) => {
      this.pushEnum(new Enum({ ..._enum, schema: this }));
    });
  }

  pushEnum (_enum: any): void {
    this.checkEnum(_enum);
    this.enums.push(_enum);
  }

  checkEnum (_enum: any): void {
    if (this.enums.some((e) => e.name === _enum.name)) {
      _enum.error(`Enum ${shouldPrintSchema(this)
        ? `"${this.name}".`
        : ''}"${_enum.name}" existed`);
    }
  }

  processRefs (rawRefs: any): void {
    rawRefs.forEach((ref: any) => {
      this.pushRef(new Ref({ ...ref, schema: this }));
    });
  }

  pushRef (ref: any): void {
    this.checkRef(ref);
    this.refs.push(ref);
  }

  checkRef (ref: any): void {
    if (this.refs.some((r) => r.equals(ref))) {
      const endpoint1 = ref.endpoints[0];
      const fieldList1 = endpoint1.fieldNames.map(JSON.stringify).join(', ');
      const endpoint2 = ref.endpoints[1];
      const fieldList2 = endpoint2.fieldNames.map(JSON.stringify).join(', ');
      const ref1 = `"${endpoint1.schemaName ? `${endpoint1.schemaName}"."` : ''}${endpoint1.tableName}"(${fieldList1})`;
      const ref2 = `"${endpoint2.schemaName ? `${endpoint2.schemaName}"."` : ''}${endpoint2.tableName}"(${fieldList2})`;
      ref.error(`Reference with the same endpoints already exists: ${ref1} references ${ref2}`);
    }
  }

  processTableGroups (rawTableGroups: any): void {
    rawTableGroups.forEach((tableGroup: any) => {
      this.pushTableGroup(new TableGroup({ ...tableGroup, schema: this }));
    });
  }

  pushTableGroup (tableGroup: any): void {
    this.checkTableGroup(tableGroup);
    this.tableGroups.push(tableGroup);
  }

  checkTableGroup (tableGroup: any): void {
    if (this.tableGroups.some((tg) => tg.name === tableGroup.name)) {
      tableGroup.error(`Table Group ${shouldPrintSchema(this) ? `"${this.name}".` : ''}"${tableGroup.name}" existed`);
    }
  }

  checkSameId (schema: any): boolean {
    return this.name === schema.name
      || this.alias === schema.name
      || this.name === schema.alias
      || Boolean(this.alias && this.alias === schema.alias);
  }

  export (): ReturnType<Schema['shallowExport']> & ReturnType<Schema['exportChild']> {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  exportChild (): {
    tables: ReturnType<Table['export']>[];
    enums: ReturnType<Enum['export']>[];
    tableGroups: ReturnType<TableGroup['export']>[];
    refs: ReturnType<Ref['export']>[];
  } {
    return {
      tables: this.tables.map((t) => t.export()),
      enums: this.enums.map((e) => e.export()),
      tableGroups: this.tableGroups.map((tg) => tg.export()),
      refs: this.refs.map((r) => r.export()),
    };
  }

  exportChildIds (): { tableIds: number[]; noteIds: number[]; enumIds: number[]; tableGroupIds: number[]; refIds: number[] } {
    return {
      tableIds: this.tables.map((t) => t.id),
      noteIds: [],
      enumIds: this.enums.map((e) => e.id),
      tableGroupIds: this.tableGroups.map((tg) => tg.id),
      refIds: this.refs.map((r) => r.id),
    };
  }

  exportParentIds (): { databaseId: number } {
    return {
      databaseId: this.database.id,
    };
  }

  shallowExport (): { name: string; note: string; alias: string } {
    return {
      name: this.name,
      note: this.note,
      alias: this.alias,
    };
  }

  normalize (model: NormalizedModel): void {
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
