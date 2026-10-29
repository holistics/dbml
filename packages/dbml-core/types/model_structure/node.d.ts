import type { ArchSettings, Node as RawNode } from '@dbml/parse';
import Element, { Token } from './element';
import Database from './database';
import DbState from './dbState';
import type { NormalizedModel } from './database';

declare class Node extends Element {
    id: number;
    name: string;
    alias: string | null;
    role: string;
    type: string | null;
    image: string | null;
    settings: ArchSettings;
    note: string | null;
    noteToken: Token | null;
    groupId: number | null;
    database: Database;
    dbState: DbState;
    constructor(raw: RawNode & { database: Database });
    generateId(): void;
    export(): Omit<NormalizedNode, 'id' | 'groupId'>;
    normalize(model: NormalizedModel): void;
}
export interface NormalizedNode {
    id: number;
    name: string;
    alias: string | null;
    role: string;
    type: string | null;
    image: string | null;
    settings: ArchSettings;
    note: string | null;
    groupId: number | null;
}
export interface NormalizedNodeIdMap {
    [_id: number]: NormalizedNode;
}
export default Node;
