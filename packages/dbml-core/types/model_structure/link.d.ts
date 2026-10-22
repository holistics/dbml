import type { ArchSettings, LinkOp, Link as RawLink } from '@dbml/parse';
import Element from './element';
import Database from './database';
import DbState from './dbState';
import type { NormalizedModel } from './database';

// What an arch link end or group member is; ids are counted per type
export type ArchElementType = 'node' | 'group' | 'note';

declare class Link extends Element {
    id: number;
    fromId: number;
    fromType: ArchElementType;
    toId: number;
    toType: ArchElementType;
    op: LinkOp;
    settings: ArchSettings;
    database: Database;
    dbState: DbState;
    constructor(raw: Omit<RawLink, 'from' | 'to'> & { fromId: number; fromType: ArchElementType; toId: number; toType: ArchElementType; database: Database });
    generateId(): void;
    export(): Omit<NormalizedLink, 'id' | 'fromId' | 'fromType' | 'toId' | 'toType'>;
    normalize(model: NormalizedModel): void;
}
export interface NormalizedLink {
    id: number;
    fromId: number;
    fromType: ArchElementType;
    toId: number;
    toType: ArchElementType;
    op: LinkOp;
    settings: ArchSettings;
}
export interface NormalizedLinkIdMap {
    [_id: number]: NormalizedLink;
}
export default Link;
