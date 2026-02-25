import Element from './element';
import Index from './indexes';
import DbState from './dbState';
import { NormalizedModel } from './database';

export interface NormalizedIndexColumn {
  id: number;
  type: string;
  value: string;
  indexId: number;
}

export interface NormalizedIndexColumnIdMap {
  [_id: number]: NormalizedIndexColumn;
}

class IndexColumn extends Element {
  type: any;
  value: any;
  index: Index;
  dbState: DbState;

  constructor ({
    type, value, index, token,
  }: { type: any; value: any; index: any; token?: any }) {
    super(token);
    this.type = type;
    this.value = value;
    this.index = index;
    this.dbState = this.index.dbState;
    this.generateId();
  }

  generateId (): void {
    this.id = this.dbState.generateId('indexColumnId');
  }

  export (): { type: any; value: any } {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds (): { indexId: number } {
    return {
      indexId: this.index.id,
    };
  }

  shallowExport (): { type: any; value: any } {
    return {
      type: this.type,
      value: this.value,
    };
  }

  normalize (model: NormalizedModel): void {
    model.indexColumns[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default IndexColumn;
