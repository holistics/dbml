import type { ArchRef, ArchSettings, Group as RawGroup } from '@dbml/parse';
import Element, { Token } from './element';
import Database from './database';
import DbState from './dbState';
import type { NormalizedModel } from './database';
import type { ArchElementType } from './link';

declare class Group extends Element {
    id: number;
    name: string;
    alias: string | null;
    children: ArchRef[];
    childIds: number[];
    childTypes: ArchElementType[];
    settings: ArchSettings;
    note: string | null;
    noteToken: Token | null;
    groupId: number | null;
    database: Database;
    dbState: DbState;
    constructor(raw: RawGroup & { database: Database });
    generateId(): void;
    export(): Omit<NormalizedGroup, 'id' | 'childIds' | 'childTypes' | 'groupId'>;
    normalize(model: NormalizedModel): void;
}
export interface NormalizedGroup {
    id: number;
    name: string;
    alias: string | null;
    childIds: number[];
    childTypes: ArchElementType[];
    settings: ArchSettings;
    note: string | null;
    groupId: number | null;
}
export interface NormalizedGroupIdMap {
    [_id: number]: NormalizedGroup;
}
export default Group;
