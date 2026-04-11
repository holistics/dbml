import Element, { Token } from './element';
import Index from './indexes';
import DbState from './dbState';

export interface RawIndexColumn {
  type: any;
  value: any;
  index: Index;
  token: Token;
}

class IndexColumn extends Element {
  type: any;
  value: any;
  index: Index;
  dbState: DbState;

  constructor ({
    type, value, index, token,
  }: RawIndexColumn) {
    super(token);
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

  normalize (model: any) {
    model.indexColumns[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default IndexColumn;
