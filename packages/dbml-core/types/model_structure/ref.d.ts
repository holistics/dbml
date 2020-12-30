import Element, { Token } from './element';
import Endpoint from './endpoint';
import Schema from './schema';
import DbState from './dbState';
import Database, { NormalizedDatabase } from './database';
interface RawRef {
    name: String;
    endpoints: Endpoint[];
    onDelete: any;
    onUpdate: any;
    token: Token;
    schema: Schema;
}
declare class Ref extends Element {
    name: String;
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
            schemaName: String;
            tableName: String;
            fieldNames: String[];
            relation: any;
        }[];
        name: String;
        onDelete: any;
        onUpdate: any;
    };
    shallowExport(): {
        name: String;
        onDelete: any;
        onUpdate: any;
    };
    exportChild(): {
        endpoints: {
            schemaName: String;
            tableName: String;
            fieldNames: String[];
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
