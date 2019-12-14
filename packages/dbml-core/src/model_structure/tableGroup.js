import Element from './element';

class TableGroup extends Element {
  constructor ({ name, token, tables = [], schema = {} }) {
    super(token);
    this.name = name;
    this.tables = [];
    this.schema = schema;

    this.processTables(tables);
  }

  processTables (rawTables) {
    rawTables.forEach((rawTable) => {
      const table = this.schema.database.findTable(rawTable);
      if (!table) {
        this.error(`Table ${rawTable.schemaName ? `${rawTable.schemaName}.` : ''}${rawTable.name} don't exist`);
      }
      this.pushTable(table);
    });
  }

  pushTable (table) {
    this.checkTable(table);
    this.tables.push(table);
    table.group = this;
  }

  checkTable (table) {
    if (this.tables.some(t => t.id === table.id)) {
      this.error(`Table ${table.schema.name}.${table.name} is already in the group`);
    }

    if (table.group) {
      this.error(`Table ${table.schema.name}.${table.name} is already in group ${table.group.name}`);
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
      tables: this.tables.map(t => ({ tableName: t.name, schemaName: t.schema.name })),
    };
  }

  exportChildIds () {
    return {
      tableIds: this.tables.map(t => t.id),
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
    };
  }

  normalize (model) {
    model.tableGroups = {
      ...model.tableGroups,
      [this.id]: {
        ...this.shallowExport(),
        ...this.exportChildIds(),
        ...this.exportParentIds(),
      },
    };
  }
}

export default TableGroup;
