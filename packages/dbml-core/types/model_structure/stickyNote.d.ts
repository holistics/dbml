import Element, { Token, Color } from './element';
import Database from './database';
import DbState from './dbState';
import { NormalizedModel } from './database';

export interface RawStickyNote {
    name: string;
    content: string;
    database: Database;
    token: Token;
    color?: Color;
}

declare class StickyNote extends Element {
    name: string;
    content: string;
    noteToken: Token;
    color?: Color;
    database: Database;
    dbState: DbState;
    id: number;
    constructor({ name, content, token, color, database }: RawStickyNote);
    generateId(): void;
    export(): {
        name: string;
        content: string;
        color?: Color;
        metadata: { [key: string]: unknown };
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedNote {
    id: number;
    name: string;
    content: string;
    color?: Color;
    metadata: { [key: string]: unknown };
    metadataIds: number[];
}

export interface NormalizedNoteIdMap {
    [id: number]: NormalizedNote;
}

export default StickyNote;
