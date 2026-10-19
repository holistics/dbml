import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type DatabaseType from '../../types/model_structure/database';
import type DbStateType from '../../types/model_structure/dbState';
import type { NoteBox as RawNoteBox } from '@dbml/parse';

// A top-level `Note` in an architecture file: a box on the canvas
class NoteBox extends Element {
  declare id: number;
  name: string;
  alias: string | null;
  content: string;
  groupId: number | null;
  database: DatabaseType;
  dbState: DbStateType;

  constructor ({
    name, alias, content, token, database,
  }: RawNoteBox & { database: any }) {
    super(token as Token);
    this.name = name;
    this.alias = alias;
    this.content = content;
    this.groupId = null;
    this.database = database;
    this.dbState = database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('elementId');
  }

  export () {
    return {
      name: this.name,
      alias: this.alias,
      content: this.content,
    };
  }

  normalize (model: NormalizedModel) {
    model.noteBoxes![this.id] = {
      id: this.id,
      ...this.export(),
      groupId: this.groupId,
    };
  }
}

export default NoteBox;
