import Element from './element';
import type { Token, Color } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type DatabaseType from '../../types/model_structure/database';
import type DbStateType from '../../types/model_structure/dbState';
import type { CustomMetadata } from '@dbml/parse';

interface RawStickyNote {
  name: string;
  content: string;
  token: Token;
  database?: any;
  color?: Color;
  metadata?: CustomMetadata;
}

class StickyNote extends Element {
  declare id: number;
  name: string;
  content: string;
  color: Color | undefined;
  metadata: CustomMetadata;
  database: DatabaseType;
  dbState: DbStateType;

  constructor ({
    name, content, color, token, database = {} as any, metadata = {},
  }: RawStickyNote) {
    super(token);
    this.name = name;
    this.content = content;
    this.color = color;
    this.metadata = metadata;
    this.database = database;
    this.dbState = this.database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('noteId');
  }

  export () {
    return {
      name: this.name,
      content: this.content,
      color: this.color,
      metadata: this.metadata,
    };
  }

  normalize (model: NormalizedModel) {
    model.notes[this.id] = {
      id: this.id,
      ...this.export(),
    };
  }
}

export default StickyNote;
