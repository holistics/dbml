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

  exportParentIds () {
    return {
      index_id: this.index.id,
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
        ...this.exportParentIds(),
      },
    };
  }
}

export default IndexColumn;
