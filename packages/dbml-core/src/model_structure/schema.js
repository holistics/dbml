import Table from './table';
import Element from './element';
import Enum from './enum';
import { DEFAULT_SCHEMA_NAME } from './config';
import TableGroup from './tableGroup';

class Schema extends Element {
  constructor ({ name, alias, note, tables = [], enums = [], tableGroups = [], token, database = {} } = {}) {
    super(token);
    this.tables = [];
    this.enums = [];
    this.tableGroups = [];
    this.name = name;
    this.note = note;
    this.alias = alias;
    this.database = database;

    this.processTables(tables);
    this.processEnums(enums);
    this.processTableGroups(tableGroups);
  }

  processTables (rawTables) {
    rawTables.forEach((table) => {
      this.pushTable(new Table({ ...table, schema: this }));
    });
  }

  pushTable (table) {
    this.checkTable(table);
    this.tables.push(table);
  }

  checkTable (table) {
    if (this.tables.some(t => t.name === table.name)) {
      table.error(`Table ${table.name} existed`);
    }
  }

  findTable (tableName) {
    return this.tables.find(t => t.name === tableName || t.alias === tableName);
  }

  processEnums (rawEnums) {
    rawEnums.forEach((_enum) => {
      this.pushEnum(new Enum({ ..._enum, schema: this }));
    });
  }

  pushEnum (_enum) {
    this.checkEnum(_enum);
    this.enums.push(_enum);
    this.bindEnumToField(_enum);
  }

  checkEnum (_enum) {
    if (this.enums.some(e => e.name === _enum.name)) {
      _enum.error(`Enum ${this.name}.${_enum.name} existed`);
    }
  }

  bindEnumToField (_enum) {
    this.database.schemas.forEach((schema) => {
      schema.tables.forEach((table) => {
        table.fields.forEach((field) => {
          if (_enum.name === field.type.type_name && (field.type.schemaName || DEFAULT_SCHEMA_NAME) === schema.name) {
            field._enum = _enum;
            _enum.pushField(field);
          }
        });
      });
    });
  }

  processTableGroups (rawTableGroups) {
    rawTableGroups.forEach((tableGroup) => {
      this.pushTableGroup(new TableGroup({ ...tableGroup, schema: this }));
    });
  }

  pushTableGroup (tableGroup) {
    this.checkTableGroup(tableGroup);
    this.tableGroups.push(tableGroup);
  }

  checkTableGroup (tableGroup) {
    if (this.tableGroups.some(tg => tg.name === tableGroup.name)) {
      tableGroup.error(`Table Group named ${tableGroup.name} existed`);
    }
  }

  checkSameId (schema) {
    return this.name === schema.name
      || this.alias === schema.name
      || this.name === schema.alias
      || (this.alias && this.alias === schema.alias);
  }

  export () {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  exportChild () {
    return {
      tables: this.tables.map(t => t.export()),
      enums: this.enums.map(e => e.export()),
      tableGroups: this.tableGroups.map(tg => tg.export()),
    };
  }

  exportChildIds () {
    return {
      table_ids: this.tables.map(t => t.id),
      enum_ids: this.enums.map(e => e.id),
      tableGroup_ids: this.tableGroups.map(tg => tg.id),
    };
  }

  shallowExport () {
    return {
      name: this.name,
      note: this.note,
      alias: this.alias,
    };
  }

  normalize (model) {
    model.schemas = {
      ...model.schemas,
      [this.id]: {
        ...this.shallowExport(),
        ...this.exportChildIds(),
      },
    };

    this.tables.forEach((table) => table.normalize(model));
    this.enums.forEach((_enum) => _enum.normalize(model));
    this.tableGroups.forEach((tableGroup) => tableGroup.normalize(model));
  }
}

export default Schema;
