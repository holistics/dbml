import { get } from 'lodash-es';
import Element, { Token, RawNote } from './element';
import EnumValue from './enumValue';
import { shouldPrintSchema } from './utils';
import Schema from './schema';
import Field from './field';
import DbState from './dbState';

export interface RawEnum {
  name: string;
  token: Token;
  values: any[];
  note: RawNote;
  schema: Schema;
  noteToken?: Token | null;
}

class Enum extends Element {
  name: string;
  note: string | null;
  noteToken: Token | null;
  values: EnumValue[];
  fields: Field[];
  schema: Schema;
  dbState: DbState;

  constructor ({
    name, token, values, note, schema, noteToken = null,
  }: RawEnum) {
    super(token);
    if (!name) {
      this.error('Enum must have a name');
    }
    this.name = name;
    this.note = note ? get(note, 'value', note) as string : null;
    this.noteToken = note ? get(note as RawNote, 'token', noteToken) : null;
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

  processValues (rawValues: any[]) {
    rawValues.forEach((value) => {
      this.pushValue(new EnumValue({ ...value, _enum: this }));
    });
  }

  pushValue (value: EnumValue) {
    this.checkValue(value);
    this.values.push(value);
  }

  checkValue (value: EnumValue) {
    if (this.values.some((v) => v.name === value.name)) {
      value.error(`Enum value "${value.name}" existed in enum ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".`
        : ''}"${this.name}"`);
    }
  }

  pushField (field: Field) {
    this.checkField(field);
    this.fields.push(field);
  }

  checkField (field: Field) {
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

  normalize (model: any) {
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
