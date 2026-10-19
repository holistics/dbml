import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type DatabaseType from '../../types/model_structure/database';
import type DbStateType from '../../types/model_structure/dbState';
import type { ArchSettings, LinkOp, Link as RawLink } from '@dbml/parse';

// An architecture link between two elements, by their ids
class Link extends Element {
  declare id: number;
  fromId: number;
  toId: number;
  op: LinkOp;
  settings: ArchSettings;
  database: DatabaseType;
  dbState: DbStateType;

  constructor ({
    fromId, toId, op, settings, token, database,
  }: Omit<RawLink, 'from' | 'to'> & { fromId: number; toId: number; database: any }) {
    super(token as Token);
    this.fromId = fromId;
    this.toId = toId;
    this.op = op;
    this.settings = settings;
    this.database = database;
    this.dbState = database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('linkId');
  }

  export () {
    return {
      op: this.op,
      settings: this.settings,
    };
  }

  normalize (model: NormalizedModel) {
    model.links![this.id] = {
      id: this.id,
      ...this.export(),
      fromId: this.fromId,
      toId: this.toId,
    };
  }
}

export default Link;
