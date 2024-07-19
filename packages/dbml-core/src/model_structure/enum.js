import { get } from 'lodash';
import Element from './element';
import EnumValue from './enumValue';
import { shouldPrintSchema } from './utils';

class Enum extends Element {
  constructor ({
    name, token, values, note, schema, noteToken = null,
  } = {}) {
    super(token);
    if (!name) { this.error('Enum must have a name'); }
    this.name = name;
    this.note = note ? get(note, 'value', note) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this.values = [];
    this.fields = [];
    this.schema = schema;
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processValues(values);
  }

  generateId () {
    this.id = this.dbState.generateId('enumId');
  }

  processValues (rawValues) {
    rawValues.forEach(value => {
      this.pushValue(new EnumValue({ ...value, _enum: this }));
    });
  }

  pushValue (value) {
    this.checkValue(value);
    this.values.push(value);
  }

  checkValue (value) {
    if (this.values.some(v => v.name === value.name)) {
      value.error(`Enum value "${value.name}" existed in enum ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".` : ''}"${this.name}"`);
    }
  }

  pushField (field) {
    this.checkField(field);
    this.fields.push(field);
  }

  checkField (field) {
    if (this.fields.some(f => f.id === field.id)) {
      this.error(`Field ${shouldPrintSchema(field.table.schema)
        ? `"${field.table.schema.name}".` : ''}"${field.table.name}"."${field.name}" already associated with enum ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".` : ''}${this.name}"`);
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
      values: this.values.map(value => value.export()),
    };
  }

  exportChildIds () {
    return {
      valueIds: this.values.map(value => value.id),
      fieldIds: this.fields.map(field => field.id),
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
    };
  }

  normalize (model) {
    model.enums[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.values.forEach(v => v.normalize(model));
  }
}

export default Enum;
