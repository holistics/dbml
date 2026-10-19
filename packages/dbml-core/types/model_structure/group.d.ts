import type { ArchSettings, Group as RawGroup } from '@dbml/parse';
import Element, { Token } from './element';
import Database from './database';
import DbState from './dbState';
import type { NormalizedModel } from './database';

declare class Group extends Element {
    id: number;
    name: string;
    alias: string | null;
    children: string[];
    childIds: number[];
    settings: ArchSettings;
    note: string | null;
    noteToken: Token | null;
    groupId: number | null;
    database: Database;
    dbState: DbState;
    constructor(raw: RawGroup & { database: Database });
    generateId(): void;
    export(): Omit<NormalizedGroup, 'id' | 'childIds' | 'groupId'>;
    normalize(model: NormalizedModel): void;
}
export interface NormalizedGroup {
    id: number;
    name: string;
    alias: string | null;
    childIds: number[];
    settings: ArchSettings;
    note: string | null;
    groupId: number | null;
}
export interface NormalizedGroupIdMap {
    [_id: number]: NormalizedGroup;
}
export default Group;
