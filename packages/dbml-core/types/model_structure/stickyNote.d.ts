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
    color?: string;
}

declare class StickyNote extends Element {
    name: string;
    content: string;
    noteToken: Token;
    headerColor: string;
    color?: string;
    database: Database;
    dbState: DbState;
    id: number;
    constructor({ name, content, token, headerColor, color, database }: RawStickyNote);
    generateId(): void;
    export(): {
        name: string;
        content: string;
        headerColor: string;
        color?: string;
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedNote {
    id: number;
    name: string;
    content: string;
    headerColor: string | null;
    color?: string;
}

export interface NormalizedNoteIdMap {
    [id: number]: NormalizedNote;
}

export default StickyNote;
