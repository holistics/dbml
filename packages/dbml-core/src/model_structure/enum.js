import Element from './element';
import EnumValue from './enumValue';

class Enum extends Element {
  constructor ({ name, token, values, note, schema } = {}) {
    super(token);
    if (!name) { this.error('Enum must have a name'); }
    this.name = name;
    this.note = note;
    this.values = [];
    this.fields = [];
    this.schema = schema;

    this.processValues(values);
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
      value.error(`Enum value ${value.name} existed in enum ${this.name}`);
    }
  }

  pushField (field) {
    this.checkField(field);
    this.fields.push(field);
  }

  checkField (field) {
    if (this.fields.some(f => f.id === field.id)) {
      this.error(`Field ${field.table.schema.name}.${field.table.name}.${field.name} already associated with enum ${this.schema.name}.${this.name}`);
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
      value_ids: this.values.map(value => value.id),
      field_ids: this.fields.map(field => field.id),
    };
  }

  exportParentIds () {
    return {
      schema_id: this.schema.id,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      note: this.note,
    };
  }

  normalize (model) {
    model.enums = {
      ...model.enums,
      [this.id]: {
        ...this.shallowExport(),
        ...this.exportChildIds(),
        ...this.exportParentIds(),
      },
    };

    this.values.forEach(v => v.normalize(model));
  }
}

export default Enum;
