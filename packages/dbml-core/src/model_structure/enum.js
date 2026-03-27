import { get } from 'lodash-es';
import Element from './element';
import EnumValue from './enumValue';
import { shouldPrintSchema } from './utils';

class Enum extends Element {
  /**
   * @param {import('../../types/model_structure/enum').RawEnum} param0
   */
  constructor ({
    name, token, values, note, schema, noteToken = null,
  } = {}) {
    super(token);
    if (!name) {
      this.error('Enum must have a name');
    }
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.note = note ? get(note, 'value', note) : null;
    /** @type {import('../../types/model_structure/element').Token} */
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    /** @type {import('../../types/model_structure/enumValue').default[]} */
    this.values = [];
    /** @type {import('../../types/model_structure/field').default[]} */
    this.fields = [];
    /** @type {import('../../types/model_structure/schema').default} */
    this.schema = schema;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processValues(values);
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('enumId');
  }

  /**
   * @param {any[]} rawValues
   */
  processValues (rawValues) {
    rawValues.forEach((value) => {
      this.pushValue(new EnumValue({ ...value, _enum: this }));
    });
  }

  /**
   * @param {import('../../types/model_structure/enumValue').default} value
   */
  pushValue (value) {
    this.checkValue(value);
    this.values.push(value);
  }

  /**
   * @param {import('../../types/model_structure/enumValue').default} value
   */
  checkValue (value) {
    if (this.values.some((v) => v.name === value.name)) {
      value.error(`Enum value "${value.name}" existed in enum ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".`
        : ''}"${this.name}"`);
    }
  }

  /**
   * @param {import('../../types/model_structure/field').default} field
   */
  pushField (field) {
    this.checkField(field);
    this.fields.push(field);
  }

  /**
   * @param {import('../../types/model_structure/field').default} field
   */
  checkField (field) {
    if (this.fields.some((f) => f.id === field.id)) {
      this.error(`Field ${shouldPrintSchema(field.table.schema)
        ? `"${field.table.schema.name}".`
        : ''}"${field.table.name}"."${field.name}" already associated with enum ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".`
        : ''}${this.name}"`);
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
      values: this.values.map((value) => value.export()),
    };
  }

  exportChildIds () {
    return {
      valueIds: this.values.map((value) => value.id),
      fieldIds: this.fields.map((field) => field.id),
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

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.enums[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.values.forEach((v) => v.normalize(model));
  }
}

export default Enum;
