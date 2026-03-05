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

declare class StickyNote extends Element {
    name: string;
    content: string;
    noteToken: Token;
    headerColor: string;
    database: Database;
    dbState: DbState;
    id: number;
    constructor({ name, content, token, headerColor, database }: RawStickyNote);
    generateId(): void;
    export(): {
        name: string;
        content: string;
        headerColor: string;
    };
    normalize(model: NormalizedModel): void;
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

export default StickyNote;
