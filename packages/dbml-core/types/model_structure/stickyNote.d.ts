import { CustomMetadata } from '@dbml/parse';
import Element, { Token, Color } from './element';
import Database from './database';
import DbState from './dbState';
import type { NormalizedModel } from './database';

export interface RawStickyNote {
    name: string;
    content: string;
    database: Database;
    token: Token;
    color?: Color;
    metadata?: CustomMetadata;
}

declare class StickyNote extends Element {
    name: string;
    content: string;
    noteToken: Token;
    color?: Color;
    metadata: CustomMetadata;
    database: Database;
    dbState: DbState;
    id: number;

    constructor({ name, content, token, color, database, metadata }: RawStickyNote);
    generateId(): void;
    export(): {
        name: string;
        content: string;
        color?: Color;
        metadata: CustomMetadata;
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedNote {
    id: number;
    name: string;
    content: string;
    color?: Color;
    metadata: CustomMetadata;
}

export interface NormalizedNoteIdMap {
    [id: number]: NormalizedNote;
}

export default StickyNote;
