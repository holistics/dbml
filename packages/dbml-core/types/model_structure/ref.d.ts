import Element, { Token } from './element';
import Endpoint, { RawEndpoint } from './endpoint';
import Schema from './schema';
import DbState from './dbState';
import Database, { NormalizedModel } from './database';
import TablePartial from './tablePartial';
export interface RawRef {
    schemaName: string | null;
    name: string | null;
    endpoints: [RawEndpoint, RawEndpoint];
    color?: string;
    onDelete?: string;
    onUpdate?: string;
    token: Token;
}
declare class Ref extends Element {
    name: string;
    color?: string;
    endpoints: Endpoint[];
    onDelete: any;
    onUpdate: any;
    schema: Schema;
    dbState: DbState;
    id: number;
    database: Database;
    injectedPartial?: TablePartial;
    constructor({ name, color, endpoints, onDelete, onUpdate, token, schema }: RawRef & {
        schema: Schema;
    });
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
        injectedPartialId?: number;
    };
    shallowExport(): {
        name: string;
        onDelete: any;
        onUpdate: any;
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
    color?: string;
    onUpdate?: string;
    onDelete?: string;
    schemaId: number;
    endpointIds: number[];
    injectedPartialId?: number;
}

export interface NormalizedRefIdMap {
    [_id: number]: NormalizedRef;
}

export default Ref;
