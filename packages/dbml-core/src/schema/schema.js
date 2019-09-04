import _ from 'lodash';
import Endpoint from './endpoint';
import Ref from './ref';
import Table from './table';
import Enum from './enum';
import TableGroup from './tableGroup';

class Schema {
  constructor ({ tables = [], enums = [], refs = [], tableGroups = [] } = {}) {
    this.refs = [];
    this.tables = [];
    this.enums = [];
    this.tableGroups = [];

    // The process order is important. Do not change !
    this.processTables(tables);
    this.processRefs(refs);
    this.processEnums(enums);
    this.processTableGroups(tableGroups);
  }

  processTables (rawTables) {
    rawTables.forEach((table) => {
      this.pushTable(new Table(table));
    });
  }

  processRefs (rawRefs) {
    rawRefs.forEach((r) => {
      const ref = {
        name: r.name,
        token: r.token,
        endpoints: r.endpoints.map(e => new Endpoint(e, this)),
      };
      this.pushRef(new Ref(ref));
    });
  }

  processEnums (rawEnums) {
    rawEnums.forEach((_enum) => {
      this.pushEnum(new Enum(_enum));
    });
    this.bindEnumRefToFields();
  }

  processTableGroups (rawTableGroups) {
    rawTableGroups.forEach((tableGroup) => {
      this.pushTableGroup(new TableGroup(tableGroup));
    });
  }

  bindEnumRefToFields () {
    const keywordString = `by|bool|boolean|bit|blob|decimal|double|enum|float|long
        |longblob|longtext|medium|mediumblob|mediumint|mediumtext|time|timestamp|tinyblob
        |tinyint|tinytext|text|bigint|int|int1|int2|int3|int4|int8|integer|float|float4
        |float8|double|char|varbinary|varchar|varcharacter|precision|date|datetime|year
        |unsigned|signed|numeric|ucase|lcase|mid|len|round|rank|now|format|coalesce|ifnull|isnull|nvl`;

    const keywords = keywordString.split('|');

    this.tables.forEach((table) => {
      table.fields.forEach((field) => {
        if (!keywords.some(e => e === field.type)) {
          const _enum = _.find(this.enums, e => e.name === field.type.type_name);
          if (_enum) {
            field.enumRef = _enum;
          }
        }
      });
    });
  }

  pushTable (table) {
    this.checkTable(table);
    this.tables.push(table);
  }

  pushEnum (_enum) {
    this.checkEnum(_enum);
    this.enums.push(_enum);
  }

  pushRef (ref) {
    this.checkRef(ref);
    this.refs.push(ref);
    ref.endpoints.forEach((endpoint) => {
      endpoint.table.pushRef(ref);
      endpoint.field.connect();
    });
  }

  pushTableGroup (tableGroup) {
    this.checkTableGroup(tableGroup);
    tableGroup.processTableNames(this);
    this.tableGroups.push(tableGroup);
  }

  checkEnum (_enum) {
    if (this.enums.some(e => e.name === _enum.name)) {
      _enum.error(`Enum ${_enum.name} existed`);
    }
  }

  checkTable (table) {
    if (this.tables.some(t => t.name === table.name)) {
      table.error(`Table ${table.name} existed`);
    }
  }


  checkRef (ref) {
    if (this.refs.some(r => r.equals(ref))) {
      ref.error('Reference with same endpoints existed');
    }
  }

  checkTableGroup (tableGroup) {
    if (this.tableGroups.some(tg => tg.name === tableGroup.name)) {
      tableGroup.error(`Table Group named ${tableGroup.name} existed`);
    }
  }

  findTable (tableName) {
    return this.tables.find(t => t.name === tableName || t.alias === tableName);
  }

  export () {
    return {
      tables: this.tables.map(t => t.export()),
      refs: this.refs.map(r => r.export()),
      enums: this.enums.map(_enum => _enum.export()),
    };
  }

  update (schema = {}) {
    const { tables = [], refs = [], enums = [] } = schema;
    this.tables.splice(0, this.tables.length, ...tables);
    this.refs.splice(0, this.refs.length, ...refs);
    this.enums.splice(0, this.enums.length, ...enums);
  }
}

export default Schema;
