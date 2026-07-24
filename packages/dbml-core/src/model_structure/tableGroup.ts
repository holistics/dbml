import { get } from 'lodash-es';
import Element from './element';
import { shouldPrintSchema } from './utils';
import type { Token, Color } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type SchemaType from '../../types/model_structure/schema';
import type TableType from '../../types/model_structure/table';
import type DbStateType from '../../types/model_structure/dbState';
import type { CustomMetadata } from '@dbml/parse';

interface RawTableGroup {
  name: string;
  token: Token;
  tables?: any[];
  schema?: any;
  note?: any;
  color?: Color;
  noteToken?: Token | null;
  metadata?: CustomMetadata;
}

class TableGroup extends Element {
  declare id: number;
  declare error: (message: string) => never;
  name: string;
  tables: TableType[];
  schema: SchemaType;
  dbState: DbStateType;
  note: string | null;
  noteToken: Token | null;
  color: Color;
  metadata: CustomMetadata;

  constructor ({
    name, token, tables = [], schema = {} as any, note, color, noteToken = null, metadata = {},
  }: RawTableGroup) {
    super(token);
    this.metadata = metadata;
    this.name = name;
    this.tables = [];
    this.schema = schema;
    this.dbState = this.schema.dbState;
    this.note = note ? get(note, 'value', note) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this.color = color!;
    this.generateId();

    this.processTables(tables);
  }

  generateId () {
    this.id = this.dbState.generateId('tableGroupId');
  }

  processTables (rawTables: any[]) {
    rawTables.forEach((rawTable) => {
      const table = (this.schema as any).database.findTable(rawTable.schemaName, rawTable.name);
      if (!table) {
        this.error(`Table ${rawTable.schemaName ? `"${rawTable.schemaName}".` : ''}${rawTable.name} don't exist`);
      }
      this.pushTable(table);
    });
  }

  pushTable (table: TableType) {
    this.checkTable(table);
    this.tables.push(table);
    (table as any).group = this;
  }

  checkTable (table: TableType) {
    if (this.tables.some((t) => t.id === table.id)) {
      this.error(`Table ${shouldPrintSchema((table as any).schema) ? `"${(table as any).schema.name}".` : ''}.${table.name} is already in the group`);
    }

    if ((table as any).group) {
      this.error(`Table ${shouldPrintSchema((table as any).schema)
        ? `"${(table as any).schema.name}".`
        : ''}.${table.name} is already in group ${shouldPrintSchema((table as any).group.schema)
        ? `"${(table as any).group.schema.name}".`
        : ''}${(table as any).group.name}`);
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
      tables: this.tables.map((t) => ({ tableName: t.name, schemaName: (t as any).schema.name })),
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
      metadata: this.metadata,
    };
  }

  normalize (model: NormalizedModel) {
    model.tableGroups[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };
  }
}

export default TableGroup;
