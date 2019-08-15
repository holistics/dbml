import Element from './element';

class EnumValue extends Element {
  constructor ({ name, token, note } = {}) {
    super(token);
    if (!name) { this.error('Enum value must have a name'); }
    this.name = name;
    this.note = note;
  }

  export () {
    return {
      name: this.name,
      note: this.note,
    };
  }
}

export default EnumValue;
