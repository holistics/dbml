import { get } from 'lodash-es';
import Element, { Token, RawNote } from './element';
import EnumValue from './enumValue';
import Field from './field';
import Schema from './schema';
import DbState from './dbState';
import { NormalizedModel } from './database';
import { shouldPrintSchema } from './utils';

interface RawEnum {
  name: string;
  token: Token;
  values: any[];
  note: RawNote;
  schema: Schema;
  noteToken?: Token | null;
}

export interface NormalizedEnum {
  id: number;
  name: string;
  note: string | null;
  valueIds: number[];
  fieldIds: number[];
  schemaId: number;
}

export interface NormalizedEnumIdMap {
  [_id: number]: NormalizedEnum;
}

class Enum extends Element {
  name: string;
  values: EnumValue[];
  note: string;
  noteToken: Token;
  schema: Schema;
  fields: Field[];
  dbState: DbState;

  constructor ({
    name, token, values, note, schema, noteToken = null,
  }: RawEnum) {
    super(token);
    if (!name) {
      this.error('Enum must have a name');
    }
    this.name = name;
    this.note = (note ? get(note, 'value', note) : null) as string;
    this.noteToken = (note ? get(note, 'token', noteToken) : null) as Token;
    this.values = [];
    this.fields = [];
    this.schema = schema;
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processValues(values);
  }

  generateId (): void {
    this.id = this.dbState.generateId('enumId');
  }

  processValues (rawValues: any): void {
    rawValues.forEach((value: any) => {
      this.pushValue(new EnumValue({ ...value, _enum: this }));
    });
  }

  pushValue (value: any): void {
    this.checkValue(value);
    this.values.push(value);
  }

  checkValue (value: any): void {
    if (this.values.some((v) => v.name === value.name)) {
      value.error(`Enum value "${value.name}" existed in enum ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".`
        : ''}"${this.name}"`);
    }
  }

  pushField (field: any): void {
    this.checkField(field);
    this.fields.push(field);
  }

  checkField (field: any): void {
    if (this.fields.some((f) => f.id === field.id)) {
      this.error(`Field ${shouldPrintSchema(field.table.schema)
        ? `"${field.table.schema.name}".`
        : ''}"${field.table.name}"."${field.name}" already associated with enum ${shouldPrintSchema(this.schema)
        ? `"${this.schema.name}".`
        : ''}${this.name}"`);
    }
  }

  export (): ReturnType<Enum['shallowExport']> & ReturnType<Enum['exportChild']> {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  exportChild (): { values: { name: string; note: string }[] } {
    return {
      values: this.values.map((value) => value.export()),
    };
  }

  exportChildIds (): { valueIds: number[]; fieldIds: number[] } {
    return {
      valueIds: this.values.map((value) => value.id),
      fieldIds: this.fields.map((field) => field.id),
    };
  }

  exportParentIds (): { schemaId: number } {
    return {
      schemaId: this.schema.id,
    };
  }

  shallowExport (): { name: string; note: string } {
    return {
      name: this.name,
      note: this.note,
    };
  }

  normalize (model: NormalizedModel): void {
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
