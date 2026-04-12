import { get, isNil } from 'lodash-es';
import Element, { Token, RawNote } from './element';
import Field from './field';
import Index from './indexes';
import { DEFAULT_SCHEMA_NAME } from './config';
import { shouldPrintSchema } from './utils';
import Check from './check';
import Schema from './schema';
import DbState from './dbState';
import TableGroup from './tableGroup';
import TablePartial from './tablePartial';

export interface RawTable {
  name: string;
  alias: string;
  note: RawNote;
  fields: any[];
  indexes: any[];
  checks?: any[];
  schema: Schema;
  token: Token;
  headerColor: string;
  partials?: any[];
  noteToken?: Token | null;
}

export interface TableRecord {
  id: number;
  schemaName?: string;
  tableName: string;
  columns: string[];
  token: Token;
  values: any[][];
  tableId?: number;
}

class Table extends Element {
  name: string;
  alias: string;
  note: string | null;
  noteToken: Token | null;
  headerColor: string;
  fields: (Field | any)[];
  indexes: Index[];
  checks: Check[];
  schema: Schema;
  partials: any[];
  records: TableRecord[];
  dbState: DbState;
  group!: TableGroup;

  constructor ({
    name, alias, note, fields = [], indexes = [], checks = [], schema = {} as Schema, token, headerColor, noteToken = null, partials = [],
  }: RawTable) {
    super(token);
    this.name = name;
    this.alias = alias;
    this.note = note ? get(note, 'value', note) as string : null;
    this.noteToken = note ? get(note as RawNote, 'token', noteToken) : null;
    this.headerColor = headerColor;
    this.fields = [];
    this.indexes = [];
    this.checks = [];
    this.schema = schema;
    this.partials = partials;
    this.records = [];
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

  generateId () {
    this.id = this.dbState.generateId('tableId');
  }

  checkFieldCount () {
    if (this.fields.length === 0) {
      this.error('Table must have at least one field');
    }
  }

  processFields (rawFields: any[]) {
    rawFields.forEach((field) => {
      this.pushField(new Field({ ...field, table: this }));
    });
  }

  pushField (field: Field) {
    this.checkField(field);
    this.fields.push(field);
  }

  checkField (field: Field) {
    if (this.fields.some((f) => f.name === field.name)) {
      field.error(`Field "${field.name}" existed in table ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".`
        : ''}"${this.name}"`);
    }
  }

  processIndexes (rawIndexes: any[]) {
    rawIndexes.forEach((index) => {
      this.pushIndex(new Index({ ...index, table: this }));
    });
  }

  pushIndex (index: Index) {
    this.checkIndex(index);
    this.indexes.push(index);
  }

  checkIndex (index: Index) {
    index.columns.forEach((column) => {
      if (column.type === 'column' && !(this.findField(column.value))) {
        index.error(`Column "${column.value}" do not exist in table ${shouldPrintSchema(this.schema)
          ? `"${this.schema.name}".`
          : ''}"${this.name}"`);
      }
    });
  }

  processChecks (checks: any[]) {
    checks.forEach((check) => {
      this.pushCheck(new Check({ ...check, table: this }));
    });
  }

  pushCheck (check: Check) {
    this.checks.push(check);
  }

  findField (fieldName: string): Field | undefined {
    return this.fields.find((f) => f.name === fieldName);
  }

  checkSameId (table: any): boolean {
    return (this.schema.checkSameId(table.schemaName || DEFAULT_SCHEMA_NAME))
      && (this.name === table.name
        || this.alias === table.name
        || this.name === table.alias
        || !!(this.alias && this.alias === table.alias));
  }

  processPartials () {
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
    const existingSettingNames = new Set<string>();
    if (!isNil(this.note)) existingSettingNames.add('note');
    if (!isNil(this.headerColor)) existingSettingNames.add('headerColor');

    // descending order, we'll inserted the partial fields from tail to head
    const sortedPartials = this.partials.sort((a, b) => b.order - a.order);

    // insert placeholder into table.fields
    [...sortedPartials].reverse().forEach((partial: any) => {
      this.fields.splice(partial.order, 0, 'dummy');
    });

    sortedPartials.forEach((partial: any) => {
      const tablePartial = this.schema.database.findTablePartial(partial.name);
      if (!tablePartial) this.error(`Table partial ${partial.name} not found`);
      partial.id = tablePartial!.id;

      if (tablePartial!.fields) {
        // ignore fields that already exist in the table, or have been added by a later partial
        const rawFields = tablePartial!.fields.filter((f: any) => !existingFieldNames.has(f.name));
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
      if (!existingSettingNames.has('note') && !isNil(tablePartial!.note)) {
        this.noteToken = null;
        this.note = tablePartial!.note;
        existingSettingNames.add('note');
      }
      if (!existingSettingNames.has('headerColor') && !isNil(tablePartial!.headerColor)) {
        this.headerColor = tablePartial!.headerColor;
        existingSettingNames.add('headerColor');
      }

      // merge indexes
      tablePartial!.indexes.forEach((index: any) => {
        this.indexes.push(new Index({ ...index, table: this, injectedPartial: tablePartial }));
      });

      tablePartial!.checks.forEach((check: any) => {
        this.checks.push(new Check({
          ...check,
          name: check.name && `${this.name}.${check.name}`, // deduplicate check names when instantiated to tables
          table: this,
          injectedPartial: tablePartial,
        }));
      });
    });
  }

  export () {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  exportChild () {
    return {
      fields: this.fields.map((f) => f.export()),
      indexes: this.indexes.map((i) => i.export()),
    };
  }

  exportChildIds () {
    return {
      fieldIds: this.fields.map((f) => f.id),
      indexIds: this.indexes.map((i) => i.id),
      checkIds: this.checks.map((c) => c.id),
    };
  }

  exportParentIds () {
    return {
      schemaId: this.schema.id,
      groupId: this.group ? this.group.id : null,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      alias: this.alias,
      note: this.note,
      headerColor: this.headerColor,
      partials: this.partials,
      recordIds: this.records.map((r) => r.id),
    };
  }

  normalize (model: any) {
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
