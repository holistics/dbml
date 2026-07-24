import { get } from 'lodash-es';
import Check from './check';
import { DEFAULT_SCHEMA_NAME } from './config';
import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type TableType from '../../types/model_structure/table';
import type EndpointType from '../../types/model_structure/endpoint';
import type EnumType from '../../types/model_structure/enum';
import type TablePartialType from '../../types/model_structure/tablePartial';
import type DbStateType from '../../types/model_structure/dbState';
import type { CustomMetadata } from '@dbml/parse';

interface RawField {
  name: string;
  type: any;
  unique: boolean;
  pk: boolean;
  token: Token;
  not_null: boolean;
  note: any;
  dbdefault: any;
  increment: boolean;
  checks?: any[];
  table?: any;
  noteToken?: Token | null;
  injectedPartial?: TablePartialType | null;
  injectedToken?: Token | null;
  metadata?: CustomMetadata;
}

class Field extends Element {
  declare id: number;
  declare error: (message: string) => never;
  name: string;
  type: any;
  unique: boolean;
  pk: boolean;
  not_null: boolean;
  note: string | null;
  noteToken: Token | null;
  dbdefault: any;
  increment: boolean;
  checks: Check[];
  endpoints: EndpointType[];
  table: TableType;
  injectedPartial: TablePartialType | null;
  injectedToken: Token | null;
  dbState: DbStateType;
  metadata: CustomMetadata;
  _enum!: EnumType;

  constructor ({
    name, type, unique, pk, token, not_null: notNull, note, dbdefault,
    increment, checks = [], table = {} as any, noteToken = null, injectedPartial = null, injectedToken = null, metadata = {},
  }: RawField) {
    super(token);
    if (!name) {
      this.error('Field must have a name');
    }
    if (!type) {
      this.error('Field must have a type');
    }
    this.name = name;
    // type : { type_name, value, schemaName }
    this.type = type;
    this.unique = unique;
    this.pk = pk;
    this.not_null = notNull;
    this.note = note ? get(note, 'value', note) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this.dbdefault = dbdefault;
    this.increment = increment;
    this.checks = [];
    this.endpoints = [];
    this.table = table;
    this.injectedPartial = injectedPartial;
    this.injectedToken = injectedToken;
    this.dbState = this.table.dbState;
    this.metadata = metadata;

    this.generateId();
    this.bindType();

    this.processChecks(checks);
  }

  generateId () {
    this.id = this.dbState.generateId('fieldId');
  }

  bindType () {
    const typeName = this.type.type_name;
    const typeSchemaName = this.type.schemaName || DEFAULT_SCHEMA_NAME;
    if (this.type.schemaName) {
      const _enum = (this.table as any).schema.database.findEnum(typeSchemaName, typeName);
      if (!_enum) {
        this.type.type_name = `${typeSchemaName}.${typeName}`;
        this.type.originalTypeName = typeName;
        return;
      }
      this._enum = _enum;
      _enum.pushField(this);
    } else {
      const _enum = (this.table as any).schema.database.findEnum(typeSchemaName, typeName);
      if (!_enum) return;
      this._enum = _enum;
      _enum.pushField(this);
    }
  }

  pushEndpoint (endpoint: EndpointType) {
    this.endpoints.push(endpoint);
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds () {
    return {
      tableId: this.table.id,
      enumId: this._enum ? this._enum.id : null,
    };
  }

  exportChildIds () {
    return {
      endpointIds: this.endpoints.map((e) => e.id),
    };
  }

  shallowExport () {
    return {
      name: this.name,
      type: this.type,
      unique: this.unique,
      pk: this.pk,
      not_null: this.not_null,
      note: this.note,
      dbdefault: this.dbdefault,
      increment: this.increment,
      injectedPartialId: this.injectedPartial?.id ?? null,
      checkIds: this.checks.map((check) => check.id),
      metadata: this.metadata,
    };
  }

  normalize (model: NormalizedModel) {
    model.fields[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.checks.forEach((check) => check.normalize(model));
  }

  processChecks (checks: any[]) {
    checks.forEach((check) => {
      this.checks.push(new Check({ ...check, table: this.table, column: this }));
    });
  }
}

export default Field;
