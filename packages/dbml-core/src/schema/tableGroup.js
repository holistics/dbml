import Element from './element';

class TableGroup extends Element {
  constructor ({ name, token, tableNames = [] }) {
    super(token);
    this.name = name;
    this.tableNames = tableNames;
    this.tables = [];
  }

  pushTable (table) {
    this.checkNewTable(table);
    this.tables.push(table);
    table.group = this;
  }

  checkNewTable (table) {
    if (this.tables.some(t => t.checkSameId(table))) {
      this.error(`Table ${table.name} is already in the group`);
    }

    if (table.group) {
      this.error(`Table ${table.name} is already in a group`);
    }
  }

  processTableNames (schema) {
    this.tableNames.forEach((tn) => {
      const table = schema.findTable(tn);
      if (!table) {
        this.error(`Table ${tn} don't exist`);
      }
      this.pushTable(table);
    });
  }
}

export default TableGroup;
