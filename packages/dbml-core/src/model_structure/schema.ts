import { get } from 'lodash-es';
import Dep from './dep';
import Element from './element';
import Enum from './enum';
import Ref from './ref';
import Table from './table';
import TableGroup from './tableGroup';
import { shouldPrintSchema } from './utils';
import type { RawSchema } from '../../types/model_structure/schema';
import type { Token } from '../../types/model_structure/element';
import type Database from '../../types/model_structure/database';
import type DbState from '../../types/model_structure/dbState';
import type { NormalizedModel } from '../../types/model_structure/database';

class Schema extends Element {
  tables: Table[];
  enums: Enum[];
  tableGroups: TableGroup[];
  refs: Ref[];
  deps: Dep[];
  name: string;
  note: string | null;
  noteToken: Token | null;
  alias: string;
  database: Database;
  dbState: DbState;
  id!: number;

  constructor ({
    name, alias, note, tables = [], refs = [], deps = [], enums = [], tableGroups = [], token, database = {} as Database, noteToken = null,
  }: Partial<RawSchema> = {}) {
    super(token);
    this.tables = [];
    this.enums = [];
    this.tableGroups = [];
    this.refs = [];
    this.deps = [];
    this.name = name!;
    this.note = note ? get(note, 'value', typeof note === 'string' ? note : null) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this.alias = alias!;
    this.database = database;
    this.dbState = this.database.dbState;
    this.generateId();

    this.processEnums(enums);
    this.processTables(tables);
    this.processRefs(refs);
    this.processDeps(deps);
    this.processTableGroups(tableGroups);
  }

  private generateId (): void {
    this.id = this.dbState.generateId('schemaId');
  }

  private processTables (rawTables: any[]): void {
    rawTables.forEach((table) => {
      this.pushTable(new Table({ ...table, schema: this }));
    });
  }

  pushTable (table: Table): void {
    this.checkTable(table);
    this.tables.push(table);
  }

  private checkTable (table: Table): void {
    if (this.tables.some((t) => t.name === table.name)) {
      table.error(`Table ${shouldPrintSchema(this) ? `"${this.name}".` : ''}"${table.name}" existed`);
    }
  }

  findTable (tableName: string): Table | undefined {
    return this.tables.find((t) => t.name === tableName);
  }

  private processEnums (rawEnums: any[]): void {
    rawEnums.forEach((_enum) => {
      this.pushEnum(new Enum({ ..._enum, schema: this }));
    });
  }

  pushEnum (_enum: Enum): void {
    this.checkEnum(_enum);
    this.enums.push(_enum);
  }

  private checkEnum (_enum: Enum): void {
    if (this.enums.some((e) => e.name === _enum.name)) {
      _enum.error(`Enum ${shouldPrintSchema(this)
        ? `"${this.name}".`
        : ''}"${_enum.name}" existed`);
    }
  }

  private processRefs (rawRefs: any[]): void {
    rawRefs.forEach((ref) => {
      this.pushRef(new Ref({ ...ref, schema: this }));
    });
  }

  pushRef (ref: Ref): void {
    this.checkRef(ref);
    this.refs.push(ref);
  }

  private checkRef (ref: Ref): void {
    if (this.refs.some((r) => r.equals(ref as any))) {
      const endpoint1 = ref.endpoints[0];
      const fieldList1 = endpoint1.fieldNames.map((s) => JSON.stringify(s)).join(', ');
      const endpoint2 = ref.endpoints[1];
      const fieldList2 = endpoint2.fieldNames.map((s) => JSON.stringify(s)).join(', ');
      const ref1 = `"${endpoint1.schemaName ? `${endpoint1.schemaName}"."` : ''}${endpoint1.tableName}"(${fieldList1})`;
      const ref2 = `"${endpoint2.schemaName ? `${endpoint2.schemaName}"."` : ''}${endpoint2.tableName}"(${fieldList2})`;
      ref.error(`Reference with the same endpoints already exists: ${ref1} references ${ref2}`);
    }
  }

  processDeps (rawDeps: any[]): void {
    rawDeps.forEach((dep) => {
      this.pushDep(new Dep({ ...dep, schema: this }));
    });
  }

  pushDep (dep: Dep): void {
    this.deps.push(dep);
  }

  private processTableGroups (rawTableGroups: any[]): void {
    rawTableGroups.forEach((tableGroup) => {
      this.pushTableGroup(new TableGroup({ ...tableGroup, schema: this }));
    });
  }

  pushTableGroup (tableGroup: TableGroup): void {
    this.checkTableGroup(tableGroup);
    this.tableGroups.push(tableGroup);
  }

  private checkTableGroup (tableGroup: TableGroup): void {
    if (this.tableGroups.some((tg) => tg.name === tableGroup.name)) {
      tableGroup.error(`Table Group ${shouldPrintSchema(this) ? `"${this.name}".` : ''}"${tableGroup.name}" existed`);
    }
  }

  checkSameId (schema: Schema): boolean {
    return this.name === schema.name
      || this.alias === schema.name
      || this.name === schema.alias
      || (!!this.alias && this.alias === schema.alias);
  }

  export () {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  private exportChild () {
    return {
      tables: this.tables.map((t) => t.export()),
      enums: this.enums.map((e) => e.export()),
      tableGroups: this.tableGroups.map((tg) => tg.export()),
      refs: this.refs.map((r) => r.export()),
      deps: this.deps.map((d) => d.export()),
    };
  }

  private exportChildIds () {
    return {
      tableIds: this.tables.map((t) => t.id),
      enumIds: this.enums.map((e) => e.id),
      tableGroupIds: this.tableGroups.map((tg) => tg.id),
      refIds: this.refs.map((r) => r.id),
      depIds: this.deps.map((d) => d.id),
    };
  }

  private exportParentIds () {
    return {
      databaseId: this.database.id,
    };
  }

  private shallowExport () {
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
    } as any;

    this.tables.forEach((table) => table.normalize(model));
    this.enums.forEach((_enum) => _enum.normalize(model));
    this.tableGroups.forEach((tableGroup) => tableGroup.normalize(model));
    this.refs.forEach((ref) => ref.normalize(model));
    this.deps.forEach((dep) => dep.normalize(model));
  }
}

export default Schema;
