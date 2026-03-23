import { get, isNil } from 'lodash-es';
import Element from './element';
import Field from './field';
import Index from './indexes';
import { DEFAULT_SCHEMA_NAME } from './config';
import { shouldPrintSchema } from './utils';
import Check from './check';

class Table extends Element {
  /**
   * @param {import('../../types/model_structure/table').RawTable} param0
   */
  constructor ({
    name, alias, note, fields = [], indexes = [], checks = [], schema = {}, token, headerColor, noteToken = null, partials = [],
  } = {}) {
    super(token);
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.alias = alias;
    /** @type {string} */
    this.note = note ? get(note, 'value', note) : null;
    /** @type {import('../../types/model_structure/element').Token} */
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    /** @type {string} */
    this.headerColor = headerColor;
    /** @type {import('../../types/model_structure/field').default[]} */
    this.fields = [];
    /** @type {import('../../types/model_structure/indexes').default[]} */
    this.indexes = [];
    /** @type {import('../../types/model_structure/check').default[]} */
    this.checks = [];
    /** @type {import('../../types/model_structure/schema').default} */
    this.schema = schema;
    /** @type {import('../../types/model_structure/tablePartial').default[]} */
    this.partials = partials;
    /** @type {import('../../types/model_structure/database').TableRecord[]} */
    this.records = [];
    /** @type {import('../../types/model_structure/dbState').default} */
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
    /** @type {number} */
    this.id = this.dbState.generateId('tableId');
  }

  checkFieldCount () {
    if (this.fields.length === 0) {
      this.error('Table must have at least one field');
    }
  }

  /**
   * @param {any[]} rawFields
   */
  processFields (rawFields) {
    rawFields.forEach((field) => {
      this.pushField(new Field({ ...field, table: this }));
    });
  }

  /**
   * @param {import('../../types/model_structure/field').default} field
   */
  pushField (field) {
    this.checkField(field);
    this.fields.push(field);
  }

  /**
   * @param {import('../../types/model_structure/field').default} field
   */
  checkField (field) {
    if (this.fields.some((f) => f.name === field.name)) {
      field.error(`Field "${field.name}" existed in table ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".`
        : ''}"${this.name}"`);
    }
  }

  /**
   * @param {any[]} rawIndexes
   */
  processIndexes (rawIndexes) {
    rawIndexes.forEach((index) => {
      this.pushIndex(new Index({ ...index, table: this }));
    });
  }

  /**
   * @param {import('../../types/model_structure/indexes').default} index
   */
  pushIndex (index) {
    this.checkIndex(index);
    this.indexes.push(index);
  }

  /**
   * @param {import('../../types/model_structure/indexes').default} index
   */
  checkIndex (index) {
    index.columns.forEach((column) => {
      if (column.type === 'column' && !(this.findField(column.value))) {
        index.error(`Column "${column.value}" do not exist in table ${shouldPrintSchema(this.schema)
          ? `"${this.schema.name}".`
          : ''}"${this.name}"`);
      }
    });
  }

  /**
   * @param {any[]} checks
   */
  processChecks (checks) {
    checks.forEach((check) => {
      this.pushCheck(new Check({ ...check, table: this }));
    });
  }

  /**
   * @param {import('../../types/model_structure/check').default} check
   */
  pushCheck (check) {
    this.checks.push(check);
  }

  /**
   * @param {string} fieldName
   * @returns {import('../../types/model_structure/field').default}
   */
  findField (fieldName) {
    return this.fields.find((f) => f.name === fieldName);
  }

  /**
   * @param {any} table
   * @returns {boolean}
   */
  checkSameId (table) {
    return (this.schema.checkSameId(table.schemaName || DEFAULT_SCHEMA_NAME))
      && (this.name === table.name
        || this.alias === table.name
        || this.name === table.alias
        || (this.alias && this.alias === table.alias));
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
    const existingSettingNames = new Set();
    if (!isNil(this.note)) existingSettingNames.add('note');
    if (!isNil(this.headerColor)) existingSettingNames.add('headerColor');

    // descending order, we'll inserted the partial fields from tail to head
    const sortedPartials = this.partials.sort((a, b) => b.order - a.order);

    // insert placeholder into table.fields
    sortedPartials.toReversed().forEach((partial) => {
      this.fields.splice(partial.order, 0, 'dummy');
    });

    sortedPartials.forEach((partial) => {
      const tablePartial = this.schema.database.findTablePartial(partial.name);
      if (!tablePartial) this.error(`Table partial ${partial.name} not found`, partial.token);
      partial.id = tablePartial.id;

      if (tablePartial.fields) {
        // ignore fields that already exist in the table, or have been added by a later partial
        const rawFields = tablePartial.fields.filter((f) => !existingFieldNames.has(f.name));
        const fields = rawFields.map((rawField) => {
          existingFieldNames.add(rawField.name);

          // convert inline_refs from injected fields to refs
          if (rawField.inline_refs) {
            rawField.inline_refs.forEach((iref) => {
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
        this.noteToken = null;
        this.note = tablePartial.note;
        existingSettingNames.add('note');
      }
      if (!existingSettingNames.has('headerColor') && !isNil(tablePartial.headerColor)) {
        this.headerColor = tablePartial.headerColor;
        existingSettingNames.add('headerColor');
      }

      // merge indexes
      tablePartial.indexes.forEach((index) => {
        this.indexes.push(new Index({ ...index, table: this, injectedPartial: tablePartial }));
      });

      tablePartial.checks.forEach((check) => {
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

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
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
