import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type DatabaseType from '../../types/model_structure/database';
import type DbStateType from '../../types/model_structure/dbState';
import type { ArchElementType } from '../../types/model_structure/link';
import type { ArchSettings, LinkOp, Link as RawLink } from '@dbml/parse';

class Link extends Element {
  declare id: number;
  fromId: number;
  fromType: ArchElementType;
  toId: number;
  toType: ArchElementType;
  op: LinkOp;
  settings: ArchSettings;
  database: DatabaseType;
  dbState: DbStateType;

  constructor ({
    fromId, fromType, toId, toType, op, settings, token, database,
  }: Omit<RawLink, 'from' | 'fromRole' | 'to' | 'toRole'> & { fromId: number; fromType: ArchElementType; toId: number; toType: ArchElementType; database: any }) {
    super(token as Token);
    this.fromId = fromId;
    this.fromType = fromType;
    this.toId = toId;
    this.toType = toType;
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
      fromType: this.fromType,
      toId: this.toId,
      toType: this.toType,
    };
  }
}

export default Link;
