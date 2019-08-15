import Element from './element';
import EnumValue from './enumValue';

class Enum extends Element {
  constructor ({ name, token, values } = {}) {
    super(token);
    if (!name) { this.error('Enum must have a name'); }
    this.name = name;
    this.values = [];

    this.processValues(values);
  }

  processValues (rawValues) {
    rawValues.forEach(value => {
      this.pushValue(new EnumValue(value));
    });
  }

  pushValue (value) {
    this.checkValue(value);
    this.values.push(value);
    value.enumRef = this;
  }

  checkValue (value) {
    if (this.values.some(v => v.name === value.name)) {
      value.error(`Enum value ${value.name} existed in enum ${this.name}`);
    }
  }

  export () {
    return {
      name: this.name,
      values: this.values.map(value => value.export()),
    };
  }
}

export default Enum;
