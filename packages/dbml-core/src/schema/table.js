import Element from './element';
import Field from './field';
import Index from './indexes';

class Table extends Element {
  constructor ({ name, alias, fields = [], token, indexes = [], headerColor } = {}) {
    super(token);
    this.name = name;
    this.alias = alias;
    this.headerColor = headerColor;
    this.fields = [];
    this.indexes = [];
    // Connected ref
    this.refs = [];

    this.processFields(fields);
    this.processIndexes(indexes);
  }

  processFields (rawFields) {
    if (rawFields.length === 0) {
      this.error('Table must have at least one field');
    }

    rawFields.forEach((field) => {
      this.pushField(new Field(field));
    });
  }

  processIndexes (rawIndexes) {
    rawIndexes.forEach((index) => {
      this.pushIndex(new Index(index));
    });
  }

  pushField (field) {
    this.checkField(field);
    this.fields.push(field);
    field.table = this;
  }

  checkField (field) {
    if (this.fields.some(f => f.name === field.name)) {
      field.error(`Field ${field.name} existed in table ${this.name}`);
    }
  }

  pushIndex (index) {
    this.checkIndex(index);
    this.indexes.push(index);
    index.table = this;
  }

  checkIndex (index) {
    index.columns.forEach((column) => {
      if (column.type === 'column' && !(this.findField(column.value))) {
        index.error(`Column ${column.value} do not exist in table ${this.name}`);
      }
    });
  }

  findField (fieldName) {
    return this.fields.find(f => f.name === fieldName);
  }

  pushRef (ref) {
    this.refs.push(ref);
  }

  checkSameId (table) {
    return this.name === table.name
      || this.alias === table.name
      || this.name === table.alias
      || (this.alias && this.alias === table.alias);
  }

  export () {
    return {
      name: this.name,
      alias: this.alias,
      fields: this.fields.map(f => f.export()),
      indexes: this.indexes.map(f => f.export()),
    };
  }
}

export default Table;
