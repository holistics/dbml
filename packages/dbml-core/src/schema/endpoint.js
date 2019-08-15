import Element from './element';

class Endpoint extends Element {
  constructor ({ tableName, fieldName, relation, token }, schema) {
    super(token);
    this.relation = relation;

    this.tableName = tableName;
    this.fieldName = fieldName;
    // Use name of table and field object
    // Name in constructor could be alias
    const table = schema.findTable(tableName);
    this.setTable(table);

    const field = table.findField(fieldName);
    this.setField(field);
  }

  equals (endpoint) {
    return this.tableName === endpoint.tableName
      && this.fieldName === endpoint.fieldName;
  }

  export () {
    return {
      tableName: this.tableName,
      fieldName: this.fieldName,
      relation: this.relation,
    };
  }

  setField (field) {
    if (!field) {
      this.error(`Can't find field ${this.fieldName} in table ${this.tableName}`);
    }
    this.field = field;
    this.fieldName = field.name;
  }

  setTable (table) {
    if (!table) {
      this.error(`Can't find table ${this.tableName} in schema`);
    }
    this.table = table;
    this.tableName = table.name;
  }
}

export default Endpoint;
