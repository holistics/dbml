import { get } from 'lodash-es';
import Element from './element';
import { shouldPrintSchema } from './utils';

class TableGroup extends Element {
  /**
   * @param {import('../../types/model_structure/tableGroup').RawTableGroup} param0
   */
  constructor ({
    name, token, tables = [], schema = {}, note, color, noteToken = null,
  }) {
    super(token);
    /** @type {string} */
    this.name = name;
    /** @type {import('../../types/model_structure/table').default[]} */
    this.tables = [];
    /** @type {import('../../types/model_structure/schema').default} */
    this.schema = schema;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = this.schema.dbState;
    /** @type {string} */
    this.note = note ? get(note, 'value', note) : null;
    /** @type {import('../../types/model_structure/element').Token} */
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    /** @type {string} */
    this.color = color;
    this.generateId();

    this.processTables(tables);
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('tableGroupId');
  }

  /**
   * @param {any[]} rawTables
   */
  processTables (rawTables) {
    rawTables.forEach((rawTable) => {
      const table = this.schema.database.findTable(rawTable.schemaName, rawTable.name);
      if (!table) {
        this.error(`Table ${rawTable.schemaName ? `"${rawTable.schemaName}".` : ''}${rawTable.name} don't exist`);
      }
      this.pushTable(table);
    });
  }

  /**
   * @param {import('../../types/model_structure/table').default} table
   */
  pushTable (table) {
    this.checkTable(table);
    this.tables.push(table);
    table.group = this;
  }

  /**
   * @param {import('../../types/model_structure/table').default} table
   */
  checkTable (table) {
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

  exportChild () {
    return {
      tables: this.tables.map((t) => ({ tableName: t.name, schemaName: t.schema.name })),
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
    };
  }

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.tableGroups[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };
  }
}

export default TableGroup;
