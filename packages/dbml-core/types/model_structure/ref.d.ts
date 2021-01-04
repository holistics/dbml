import Element, { Token } from './element';
import Endpoint from './endpoint';
import Schema from './schema';
import DbState from './dbState';
import Database, { NormalizedDatabase } from './database';
interface RawRef {
    name: string;
    endpoints: Endpoint[];
    onDelete: any;
    onUpdate: any;
    token: Token;
    schema: Schema;
}
declare class Ref extends Element {
    name: string;
    endpoints: Endpoint[];
    onDelete: any;
    onUpdate: any;
    schema: Schema;
    dbState: DbState;
    id: number;
    database: Database;
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
    };
    shallowExport(): {
        name: string;
        onDelete: any;
        onUpdate: any;
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
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedRef {
    [_id: number]: {
        id: number;
        endpointIds: number[];
        schemaId: number;
    };
}
export default Ref;
