import type { NoteBox as RawNoteBox } from '@dbml/parse';
import Element from './element';
import Database from './database';
import DbState from './dbState';
import type { NormalizedModel } from './database';

declare class NoteBox extends Element {
    id: number;
    name: string;
    alias: string | null;
    content: string;
    groupId: number | null;
    database: Database;
    dbState: DbState;
    constructor(raw: RawNoteBox & { database: Database });
    generateId(): void;
    export(): Omit<NormalizedNoteBox, 'id' | 'groupId'>;
    normalize(model: NormalizedModel): void;
}
export interface NormalizedNoteBox {
    id: number;
    name: string;
    alias: string | null;
    content: string;
    groupId: number | null;
}
export interface NormalizedNoteBoxIdMap {
    [_id: number]: NormalizedNoteBox;
}
export default NoteBox;
