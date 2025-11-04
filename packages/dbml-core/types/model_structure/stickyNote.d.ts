import Element, { Token } from './element';
import Database, { NormalizedDatabase } from './database';
import DbState from './dbState';

interface RawStickyNote {
    name: string;
    content: string;
    database: Database;
    token: Token;
    headerColor: string;
}
declare class StickyNote extends Element {
  name: string;
  content: string;
  noteToken: Token;
  headerColor: string;
  database: Database;
  dbState: DbState;
  id: number;
  constructor({
    name, content, token, headerColor, database,
  }: RawStickyNote);
  generateId(): void;
  export(): {
        name: string;
        content: string;
        headerColor: string;
    };
  normalize(model: NormalizedDatabase): void;
}
export interface NormalizedStickyNote {
    [id: number]: {
        id: number;
        name: string;
        content: string;
        headerColor: string;
    };
}
export default StickyNote;
