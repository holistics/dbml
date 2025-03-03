import { get } from 'lodash';
import Table from './table';
import Element from './element';
import Enum from './enum';
import { shouldPrintSchema } from './utils';
import TableGroup from './tableGroup';
import Ref from './ref';

class Schema extends Element {
  constructor ({
    name, alias, note, tables = [], refs = [], enums = [], tableGroups = [], token, database = {}, noteToken = null,
  } = {}) {
    super(token);
    this.tables = [];
    this.enums = [];
    this.tableGroups = [];
    this.refs = [];
    this.name = name;
    this.note = note ? get(note, 'value', note) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this.alias = alias;
    this.database = database;
    this.dbState = this.database.dbState;
    this.generateId();

    this.processEnums(enums);
    this.processTables(tables);
    this.processRefs(refs);
    this.processTableGroups(tableGroups);
  }

  generateId () {
    this.id = this.dbState.generateId('schemaId');
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
      table.error(`Table ${shouldPrintSchema(this) ? `"${this.name}".` : ''}"${table.name}" existed`);
    }
  }

  findTable (tableName) {
    return this.tables.find(t => t.name === tableName);
  }

  processEnums (rawEnums) {
    rawEnums.forEach((_enum) => {
      this.pushEnum(new Enum({ ..._enum, schema: this }));
    });
  }

  pushEnum (_enum) {
    this.checkEnum(_enum);
    this.enums.push(_enum);
  }

  checkEnum (_enum) {
    if (this.enums.some(e => e.name === _enum.name)) {
      _enum.error(`Enum ${shouldPrintSchema(this)
        ? `"${this.name}".` : ''}"${_enum.name}" existed`);
    }
  }

  processRefs (rawRefs) {
    rawRefs.forEach((ref) => {
      this.pushRef(new Ref({ ...ref, schema: this }));
    });
  }

  pushRef (ref) {
    this.checkRef(ref);
    this.refs.push(ref);
  }

  checkRef (ref) {
    if (this.refs.some(r => r.equals(ref))) {
      const endpoint1 = ref.endpoints[0];
      const fieldList1 = endpoint1.fieldNames.map(JSON.stringify).join(', ');
      const endpoint2 = ref.endpoints[1];
      const fieldList2 = endpoint2.fieldNames.map(JSON.stringify).join(', ');
      const ref1 = `"${endpoint1.schemaName ? `${endpoint1.schemaName}"."` : ''}${endpoint1.tableName}"(${fieldList1})`;
      const ref2 = `"${endpoint2.schemaName ? `${endpoint2.schemaName}"."` : ''}${endpoint2.tableName}"(${fieldList2})`;
      ref.error(`Reference with the same endpoints already exists: ${ref1} references ${ref2}`);
    }
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
      tableGroup.error(`Table Group ${shouldPrintSchema(this) ? `"${this.name}".` : ''}"${tableGroup.name}" existed`);
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
      refs: this.refs.map(r => r.export()),
    };
  }

  exportChildIds () {
    return {
      tableIds: this.tables.map(t => t.id),
      enumIds: this.enums.map(e => e.id),
      tableGroupIds: this.tableGroups.map(tg => tg.id),
      refIds: this.refs.map(r => r.id),
    };
  }

  exportParentIds () {
    return {
      databaseId: this.database.id,
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
    model.schemas[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.tables.forEach((table) => table.normalize(model));
    this.enums.forEach((_enum) => _enum.normalize(model));
    this.tableGroups.forEach((tableGroup) => tableGroup.normalize(model));
    this.refs.forEach((ref) => ref.normalize(model));
  }
}

export default Schema;
