import Element, { Token } from './element';
import Endpoint from './endpoint';
import Schema from './schema';
import DbState from './dbState';
import Database, { NormalizedModel } from './database';
import TablePartial from './tablePartial';
interface RawRef {
    name: string;
    color?: string;
    endpoints: Endpoint[];
    onDelete: any;
    onUpdate: any;
    token: Token;
    schema: Schema;
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
    constructor({ name, endpoints, onDelete, onUpdate, token, schema }: RawRef);
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
    schemaId: number;
    endpointIds: number[];
}

export interface NormalizedRefIdMap {
    [_id: number]: NormalizedRef;
}

export default Ref;
