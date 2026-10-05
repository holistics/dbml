import type { CustomMetadata } from '@dbml/parse';
import Element, { Token, Color } from './element';
import Endpoint from './endpoint';
import Schema from './schema';
import DbState from './dbState';
import Database, { NormalizedModel } from './database';
import TablePartial from './tablePartial';
export interface RawRef {
    name: string;
    color?: Color;
    endpoints: Endpoint[];
    onDelete: any;
    onUpdate: any;
    inactive?: boolean;
    metadata?: CustomMetadata;
    token: Token;
    schema: Schema;
}
declare class Ref extends Element {
    name: string;
    color?: Color;
    endpoints: Endpoint[];
    onDelete: any;
    onUpdate: any;
    inactive?: boolean;
    metadata: CustomMetadata;
    schema: Schema;
    dbState: DbState;
    id: number;
    database: Database;
    injectedPartial?: TablePartial;
    constructor({ name, endpoints, onDelete, onUpdate, metadata, token, schema }: RawRef);
    generateId(): void;
    processEndpoints(rawEndpoints: any): void;
    equals(ref: any): any;
    export(): {
        endpoints: {
            schemaName: string;
            tableName: string;
            fieldNames: string[];
            relation: any;
        }[];
        name: string;
        onDelete: any;
        onUpdate: any;
        metadata: CustomMetadata;
        injectedPartialId?: number;
    };
    shallowExport(): {
        name: string;
        onDelete: any;
        onUpdate: any;
        metadata: CustomMetadata;
        injectedPartialId?: number;
    };
    exportChild(): {
        endpoints: {
            schemaName: string;
            tableName: string;
            fieldNames: string[];
            relation: any;
        }[];
    };
    exportChildIds(): {
        endpointIds: number[];
    };
    exportParentIds(): {
        schemaId: number;
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedRef {
    id: number;
    name: string | null;
    color?: Color;
    onUpdate?: string;
    onDelete?: string;
    inactive?: boolean;
    metadata: CustomMetadata;
    schemaId: number;
    endpointIds: number[];
    injectedPartialId?: number;
}

export interface NormalizedRefIdMap {
    [_id: number]: NormalizedRef;
}

export default Ref;
