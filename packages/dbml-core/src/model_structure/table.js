import { get } from 'lodash';
import Element from './element';
import Field from './field';
import Index from './indexes';
import { DEFAULT_SCHEMA_NAME } from './config';
import { shouldPrintSchema } from './utils';
import Ref from './ref';

class Table extends Element {
  constructor ({
    name, alias, note, fields = [], indexes = [], schema = {}, token, headerColor, noteToken = null, partials = [],
  } = {}) {
    super(token);
    this.name = name;
    this.alias = alias;
    this.note = note ? get(note, 'value', note) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this.headerColor = headerColor;
    this.fields = [];
    this.indexes = [];
    this.schema = schema;
    this.partials = partials;
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processFields(fields);
    this.processIndexes(indexes);
    this.processPartials();
  }

  generateId () {
    this.id = this.dbState.generateId('tableId');
  }

  processFields (rawFields) {
    if (rawFields.length === 0) {
      this.error('Table must have at least one field');
    }

    rawFields.forEach((field) => {
      this.pushField(new Field({ ...field, table: this }));
    });
  }

  pushField (field) {
    this.checkField(field);
    this.fields.push(field);
  }

  checkField (field) {
    if (this.fields.some(f => f.name === field.name)) {
      field.error(`Field "${field.name}" existed in table ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".` : ''}"${this.name}"`);
    }
  }

  processIndexes (rawIndexes) {
    rawIndexes.forEach((index) => {
      this.pushIndex(new Index({ ...index, table: this }));
    });
  }

  pushIndex (index) {
    this.checkIndex(index);
    this.indexes.push(index);
  }

  checkIndex (index) {
    index.columns.forEach((column) => {
      if (column.type === 'column' && !(this.findField(column.value))) {
        index.error(`Column "${column.value}" do not exist in table ${shouldPrintSchema(this.schema)
          ? `"${this.schema.name}".` : ''}"${this.name}"`);
      }
    });
  }

  findField (fieldName) {
    return this.fields.find(f => f.name === fieldName);
  }

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
     *  the definition from the most recently processed partial containing the conflicting name is used.
     *
     * Indexes with identical column tuples and attributes will be merged into a single index.
     */

    const existingFieldNames = new Set(this.fields.map(f => f.name));

    // descending order, we'll inserted the partial fields from tail to head
    const sortedPartials = this.partials.sort((a, b) => b.order - a.order);

    sortedPartials.forEach((partial) => {

      const tablePartial = this.schema.database.findTablePartial(partial.name);

      if (tablePartial.fields) {
        // ignore fields that already exist in the table, or have been added by a later partial
        const rawFields = tablePartial.fields.filter(f => !existingFieldNames.has(f.name));

        const fields =  rawFields.map((rawField) => {
          existingFieldNames.add(rawField.name);

          // convert inline_refs from injected fields to refs
          if (rawFields.inline_refs) {
            const schema = this.schema.database.findOrCreateSchema(DEFAULT_SCHEMA_NAME);
            const ref = new Ref({ endpoints: [{
              tableName: this.name,
              schemaName: this.schemaName,
              fieldNames: [rawField.name],
              relation: ['-', '<'].includes(rawFields.inline_refs.relation) ? '1' : '*',
            }, {
              tableName: rawFields.inline_refs.tableName,
              schemaName: rawFields.inline_refs.schemaName,
              fieldNames: rawFields.inline_refs.fieldNames,
              relation: ['-', '>'].includes(rawFields.inline_refs.relation) ? '1' : '*',
            }], schema, injectedPartial: tablePartial });

            schema.pushRef(ref);
          }

          return new Field({ ...rawField, table: this, injectedPartial: tablePartial });
        });

        this.fields.splice(partial.order, 0, ...fields);
      }

      // TODO: index merging
    });
  }

  exportChild () {
    return {
      fields: this.fields.map(f => f.export()),
      indexes: this.indexes.map(i => i.export()),
    };
  }

  exportChildIds () {
    return {
      fieldIds: this.fields.map(f => f.id),
      indexIds: this.indexes.map(i => i.id),
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
    };
  }

  normalize (model) {
    model.tables[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.fields.forEach((field) => field.normalize(model));
    this.indexes.forEach((index) => index.normalize(model));
  }
}

export default Table;
