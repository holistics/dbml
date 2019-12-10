import Element from './element';

class EnumValue extends Element {
  constructor ({ name, token, note, _enum } = {}) {
    super(token);
    if (!name) { this.error('Enum value must have a name'); }
    this.name = name;
    this.note = note;
    this._enum = _enum;
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  shallowExport () {
    return {
      name: this.name,
      note: this.note,
    };
  }

  normalize (model) {
    model.enumValues = {
      ...model.enumValues,
      [this.id]: {
        ...this.shallowExport(),
      },
    };
  }
}

export default EnumValue;
