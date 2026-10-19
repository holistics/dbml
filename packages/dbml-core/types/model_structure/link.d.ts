import type { ArchSettings, LinkOp, Link as RawLink } from '@dbml/parse';
import Element from './element';
import Database from './database';
import DbState from './dbState';
import type { NormalizedModel } from './database';

declare class Link extends Element {
    id: number;
    fromId: number;
    toId: number;
    op: LinkOp;
    settings: ArchSettings;
    database: Database;
    dbState: DbState;
    constructor(raw: Omit<RawLink, 'from' | 'to'> & { fromId: number; toId: number; database: Database });
    generateId(): void;
    export(): Omit<NormalizedLink, 'id' | 'fromId' | 'toId'>;
    normalize(model: NormalizedModel): void;
}
export interface NormalizedLink {
    id: number;
    fromId: number;
    toId: number;
    op: LinkOp;
    settings: ArchSettings;
}
export interface NormalizedLinkIdMap {
    [_id: number]: NormalizedLink;
}
export default Link;
