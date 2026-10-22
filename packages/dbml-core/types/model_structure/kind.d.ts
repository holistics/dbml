import type { KindCategory, Kind as RawKind } from '@dbml/parse';
import Element from './element';
import Database from './database';
import DbState from './dbState';
import type { NormalizedModel } from './database';

declare class Kind extends Element {
    id: number;
    name: string;
    icon: string;
    glyph: string[] | null;
    image: string | null;
    category: KindCategory;
    color: string | null;
    builtin: boolean;
    database: Database;
    dbState: DbState;
    constructor(raw: RawKind & { database: Database });
    generateId(): void;
    export(): Omit<NormalizedKind, 'id'>;
    normalize(model: NormalizedModel): void;
}
export interface NormalizedKind {
    id: number;
    name: string;
    icon: string;
    glyph: string[] | null;
    image: string | null;
    category: KindCategory;
    color: string | null;
    builtin: boolean;
}
export interface NormalizedKindIdMap {
    [_id: number]: NormalizedKind;
}
export default Kind;
