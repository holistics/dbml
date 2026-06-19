import Element, { Token } from './element';
import Database, { NormalizedModel } from './database';
import DbState from './dbState';

export interface RawMetadataTarget {
    kind: string;
    name: string[];
}

export interface RawMetadata {
    target: RawMetadataTarget;
    values: { [key: string]: unknown };
    token: Token;
    database: Database;
}

declare class Metadata extends Element {
    targetKind: string;
    targetName: string[];
    values: { [key: string]: unknown };
    target: Element | null;
    database: Database;
    dbState: DbState;
    id: number;
    constructor({ target, values, token, database }: RawMetadata);
    generateId(): void;
    export(): {
        targetKind: string;
        targetName: string[];
        values: { [key: string]: unknown };
        targetId: number | null;
    };
    shallowExport(): {
        targetKind: string;
        targetName: string[];
        values: { [key: string]: unknown };
    };
    exportParentIds(): {
        targetId: number | null;
    };
    normalize(model: NormalizedModel): void;
}

export interface NormalizedMetadata {
    id: number;
    targetKind: string;
    targetName: string[];
    values: { [key: string]: unknown };
    targetId: number | null;
}

export interface NormalizedMetadataIdMap {
    [id: number]: NormalizedMetadata;
}

export default Metadata;
