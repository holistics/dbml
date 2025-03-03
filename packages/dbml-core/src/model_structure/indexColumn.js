import Element from './element';

class IndexColumn extends Element {
  constructor ({ type, value, index, token }) {
    super();
    this.type = type;
    this.value = value;
    this.index = index;
    this.token = token;
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
    model.indexColumns[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default IndexColumn;
