import { get } from 'lodash';
import Element from './element';
import Field from './field';
import Index from './indexes';
import { DEFAULT_SCHEMA_NAME } from './config';
import { shouldPrintSchema } from './utils';

class TablePartial extends Element {
  constructor ({
    name, note, fields = [], indexes = [], token, headerColor, noteToken = null, dbState
  } = {}) {
    super(token);
    this.name = name;
    this.note = note ? get(note, 'value', note) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this.headerColor = headerColor;
    this.fields = fields;
    this.indexes = indexes;
    this.dbState = dbState;
    this.generateId();

    // this.processFields(fields);
    // this.processIndexes(indexes);
  }

  generateId () {
    this.id = this.dbState.generateId('tablePartialId');
  }

  // processFields (rawFields) {
  //   rawFields.forEach((field) => {
  //     this.pushField(new Field({ ...field, table: this }));
  //   });
  // }

  // pushField (field) {
  //   this.checkField(field);
  //   this.fields.push(field);
  // }

  // checkField (field) {
  //   if (this.fields.some(f => f.name === field.name)) {
  //     field.error(`Field "${field.name}" existed in table partial "${this.name}"`);
  //   }
  // }

  // processIndexes (rawIndexes) {
  //   rawIndexes.forEach((index) => {
  //     this.pushIndex(new Index({ ...index, table: this }));
  //   });
  // }

  // pushIndex (index) {
  //   this.checkIndex(index);
  //   this.indexes.push(index);
  // }

  // checkIndex (index) {
  //   index.columns.forEach((column) => {
  //     if (column.type === 'column' && !(this.findField(column.value))) {
  //       index.error(`Column "${column.value}" do not exist in table partial "${this.name}"`);
  //     }
  //   });
  // }

  // findField (fieldName) {
  //   return this.fields.find(f => f.name === fieldName);
  // }

  export () {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
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

  shallowExport () {
    return {
      name: this.name,
      note: this.note,
      headerColor: this.headerColor,
    };
  }

  normalize (model) {
    model.tablePartials[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
    };

    this.fields.forEach((field) => field.normalize(model));
    this.indexes.forEach((index) => index.normalize(model));
  }
}

export default TablePartial;
