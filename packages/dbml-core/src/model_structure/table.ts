import { get, isNil } from 'lodash-es';
import Element, { RawNote, Token } from './element';
import Field from './field';
import Index from './indexes';
import { DEFAULT_SCHEMA_NAME } from './config';
import { shouldPrintSchema } from './utils';
import Check from './check';
import Schema from './schema';
import DbState from './dbState';
import TableGroup from './tableGroup';
import TablePartial from './tablePartial';
import { NormalizedModel } from './database';

interface RawTable {
  name: string;
  alias: string;
  note: RawNote;
  fields: Field[];
  indexes: Index[];
  checks?: any[];
  schema: Schema;
  token: Token;
  headerColor: string;
  partials: TablePartial[];
  noteToken?: Token | null;
}

export interface NormalizedTable {
  id: number;
  name: string;
  alias: string | null;
  note: string | null;
  headerColor: string;
  fieldIds: number[];
  indexIds: number[];
  checkIds: number[];
  schemaId: number;
  groupId: number | null;
  partials: TablePartial[];
}

export interface NormalizedTableIdMap {
  [id: number]: NormalizedTable;
}

class Table extends Element {
  name: string;
  alias: string;
  note: string;
  noteToken: Token;
  fields: Field[];
  indexes: Index[];
  checks: Check[];
  schema: Schema;
  headerColor: string;
  dbState: DbState;
  group!: TableGroup;
  partials: TablePartial[];

  constructor ({
    name, alias, note, fields = [], indexes = [], checks = [], schema = {} as Schema, token, headerColor, noteToken = null, partials = [],
  }: RawTable) {
    super(token);
    this.name = name;
    this.alias = alias;
    this.note = (note ? get(note, 'value', note) : null) as string;
    this.noteToken = (note ? get(note, 'token', noteToken) : null) as Token;
    this.headerColor = headerColor;
    this.fields = [];
    this.indexes = [];
    this.checks = [];
    this.schema = schema;
    this.partials = partials;
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processFields(fields);
    // Process partials after fields to get injected fields' orders
    // Process partials before indexes for indexes to properly check all owned and injected columns
    this.processPartials();
    this.checkFieldCount();
    this.processIndexes(indexes);
    this.processChecks(checks);
  }

  generateId (): void {
    this.id = this.dbState.generateId('tableId');
  }

  checkFieldCount (): void {
    if (this.fields.length === 0) {
      this.error('Table must have at least one field');
    }
  }

  processFields (rawFields: any): void {
    rawFields.forEach((field: any) => {
      this.pushField(new Field({ ...field, table: this }));
    });
  }

  pushField (field: any): void {
    this.checkField(field);
    this.fields.push(field);
  }

  checkField (field: any): void {
    if (this.fields.some((f) => f.name === field.name)) {
      field.error(`Field "${field.name}" existed in table ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".`
        : ''}"${this.name}"`);
    }
  }

  processIndexes (rawIndexes: any): void {
    rawIndexes.forEach((index: any) => {
      this.pushIndex(new Index({ ...index, table: this }));
    });
  }

  pushIndex (index: any): void {
    this.checkIndex(index);
    this.indexes.push(index);
  }

  checkIndex (index: any): void {
    index.columns.forEach((column: any) => {
      if (column.type === 'column' && !(this.findField(column.value))) {
        index.error(`Column "${column.value}" do not exist in table ${shouldPrintSchema(this.schema)
          ? `"${this.schema.name}".`
          : ''}"${this.name}"`);
      }
    });
  }

  processChecks (checks: any[]): void {
    checks.forEach((check) => {
      this.pushCheck(new Check({ ...check, table: this }));
    });
  }

  pushCheck (check: any): void {
    this.checks.push(check);
  }

  findField (fieldName: any): Field | undefined {
    return this.fields.find((f) => f.name === fieldName);
  }

  checkSameId (table: any): boolean {
    return (this.schema.checkSameId(table.schemaName || DEFAULT_SCHEMA_NAME))
      && (this.name === table.name
        || this.alias === table.name
        || this.name === table.alias
        || Boolean(this.alias && this.alias === table.alias));
  }

  processPartials (): void {
    if (!this.partials?.length) return;
    /**
     * When encountering conflicting columns or settings with identical names, the following resolution order is applied:
     * 1. Local Table Definition: If a definition exists within the local table, it takes precedence.
     * 2. Last Partial Definition: If no local definition is found,
     *  the definition from the last partial (in dbml source) containing the conflicting name is used.
     *
     * each partial has the following structure:
     * {
     *   name: string,
     *   order: number, // determine where the partials fields will be injected in comparison with the table fields and other partials
     *   token, // token of the partial definition
     * }
     */
    const existingFieldNames = new Set(this.fields.map((f) => f.name));
    const existingSettingNames = new Set();
    if (!isNil(this.note)) existingSettingNames.add('note');
    if (!isNil(this.headerColor)) existingSettingNames.add('headerColor');

    // descending order, we'll inserted the partial fields from tail to head
    const sortedPartials = this.partials.sort((a: any, b: any) => b.order - a.order);

    // insert placeholder into table.fields
    [...sortedPartials].reverse().forEach((partial: any) => {
      this.fields.splice(partial.order, 0, 'dummy' as any);
    });

    sortedPartials.forEach((partial: any) => {
      const tablePartial = this.schema.database.findTablePartial(partial.name)!;
      if (!tablePartial) this.error(`Table partial ${partial.name} not found`);
      partial.id = tablePartial.id;

      if (tablePartial.fields) {
        // ignore fields that already exist in the table, or have been added by a later partial
        const rawFields = tablePartial.fields.filter((f: any) => !existingFieldNames.has(f.name));
        const fields = rawFields.map((rawField: any) => {
          existingFieldNames.add(rawField.name);

          // convert inline_refs from injected fields to refs
          if (rawField.inline_refs) {
            rawField.inline_refs.forEach((iref: any) => {
              const ref = {
                token: rawField.token,
                endpoints: [{
                  tableName: this.name,
                  schemaName: this.schema?.name,
                  fieldNames: [rawField.name],
                  relation: ['-', '<'].includes(iref.relation) ? '1' : '*',
                  token: rawField.token,
                }, {
                  tableName: iref.tableName,
                  schemaName: iref.schemaName,
                  fieldNames: iref.fieldNames,
                  relation: ['-', '>'].includes(iref.relation) ? '1' : '*',
                  token: iref.token,
                }],
                injectedPartial: tablePartial,
              };
              // The global array containing references with 1 endpoint being a field injected from a partial to a table
              this.schema.database.injectedRawRefs.push(ref);
            });
          }

          return new Field({
            ...rawField,
            noteToken: null,
            table: this,
            injectedPartial: tablePartial,
            injectedToken: partial.token,
          });
        });

        this.fields.splice(partial.order, 1, ...fields);
      } else {
        this.fields.splice(partial.order, 1); // still need to remove the dummy element, even when there's no field in the partial
      }

      // merge settings
      if (!existingSettingNames.has('note') && !isNil(tablePartial.note)) {
        this.noteToken = null as unknown as Token;
        this.note = tablePartial.note;
        existingSettingNames.add('note');
      }
      if (!existingSettingNames.has('headerColor') && !isNil(tablePartial.headerColor)) {
        this.headerColor = tablePartial.headerColor;
        existingSettingNames.add('headerColor');
      }

      // merge indexes
      tablePartial.indexes.forEach((index: any) => {
        this.indexes.push(new Index({ ...index, table: this, injectedPartial: tablePartial }));
      });

      tablePartial.checks.forEach((check: any) => {
        this.checks.push(new Check({
          ...check,
          name: check.name && `${this.name}.${check.name}`, // deduplicate check names when instantiated to tables
          table: this,
          injectedPartial: tablePartial,
        }));
      });
    });
  }

  export (): ReturnType<Table['shallowExport']> & ReturnType<Table['exportChild']> {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  exportChild (): {
    fields: ReturnType<Field['export']>[];
    indexes: ReturnType<Index['export']>[];
  } {
    return {
      fields: this.fields.map((f) => f.export()),
      indexes: this.indexes.map((i) => i.export()),
    };
  }

  exportChildIds (): { fieldIds: number[]; indexIds: number[]; checkIds: number[] } {
    return {
      fieldIds: this.fields.map((f) => f.id),
      indexIds: this.indexes.map((i) => i.id),
      checkIds: this.checks.map((c) => c.id),
    };
  }

  exportParentIds (): { schemaId: number; groupId: number | null } {
    return {
      schemaId: this.schema.id,
      groupId: this.group ? this.group.id : null,
    };
  }

  shallowExport (): {
    name: string;
    alias: string;
    note: string;
    headerColor: string;
    partials: TablePartial[];
  } {
    return {
      name: this.name,
      alias: this.alias,
      note: this.note,
      headerColor: this.headerColor,
      partials: this.partials,
    };
  }

  normalize (model: NormalizedModel): void {
    model.tables[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.fields.forEach((field) => field.normalize(model));
    this.indexes.forEach((index) => index.normalize(model));
    this.checks.forEach((check) => check.normalize(model));
  }
}

export default Table;
