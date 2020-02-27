import Element from './element';

class IndexColumn extends Element {
  constructor ({ type, value, index }) {
    super();
    this.type = type;
    this.value = value;
    this.index = index;
    this.dbState = this.index.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('indexColumnId');
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds () {
    return {
      indexId: this.index.id,
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
        id: this.id,
        ...this.shallowExport(),
        ...this.exportParentIds(),
      },
    };
  }
}

export default IndexColumn;
