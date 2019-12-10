import Element from './element';

class IndexColumn extends Element {
  constructor ({ type, value, index }) {
    super();
    this.type = type;
    this.value = value;
    this.index = index;
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  shallowExport () {
    return {
      type: this.type,
      value: this.value,
    };
  }

  normalize (model) {
    model.indexColumns = {
      ...model.indexColumns,
      [this.id]: {
        ...this.shallowExport(),
      },
    };
  }
}

export default IndexColumn;
