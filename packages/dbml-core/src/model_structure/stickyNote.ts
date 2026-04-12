import Element, { Token } from './element';
import Database from './database';
import DbState from './dbState';

export interface RawStickyNote {
  name: string;
  content: string;
  database: Database;
  token: Token;
  headerColor: string;
}

class StickyNote extends Element {
  name: string;
  content: string;
  headerColor: string;
  database: Database;
  dbState: DbState;

  constructor ({
    name, content, headerColor, token, database = {} as Database,
  }: RawStickyNote) {
    super(token);
    this.name = name;
    this.content = content;
    this.headerColor = headerColor;
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
      headerColor: this.headerColor,
    };
  }

  normalize (model: any) {
    model.notes[this.id] = {
      id: this.id,
      ...this.export(),
    };
  }
}

export default StickyNote;
