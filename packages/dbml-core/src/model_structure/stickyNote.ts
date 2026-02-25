import Element, { Token } from './element';
import Database from './database';
import DbState from './dbState';
import { NormalizedModel } from './database';

export interface RawStickyNote {
  name: string;
  content: string;
  database: Database;
  token: Token;
  headerColor: string;
}

export interface NormalizedNote {
  id: number;
  name: string;
  content: string;
  headerColor: string | null;
}

export interface NormalizedNoteIdMap {
  [id: number]: NormalizedNote;
}

class StickyNote extends Element {
  name: string;
  content: string;
  noteToken!: Token;
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

  generateId (): void {
    this.id = this.dbState.generateId('noteId');
  }

  export (): { name: string; content: string; headerColor: string } {
    return {
      name: this.name,
      content: this.content,
      headerColor: this.headerColor,
    };
  }

  normalize (model: NormalizedModel): void {
    model.notes[this.id] = {
      id: this.id,
      ...this.export(),
    };
  }
}

export default StickyNote;
