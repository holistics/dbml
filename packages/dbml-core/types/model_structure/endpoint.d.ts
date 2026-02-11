import Element, { Token } from './element';
import Field from './field';
import Ref from './ref';
import DbState from './dbState';
import { NormalizedModel } from './database';

export interface RawEndpoint {
    schemaName: string | null;
    tableName: string;
    fieldNames: string[];
    relation: '1' | '*';
    token: Token;
}

declare class Endpoint extends Element {
    relation: any;
    schemaName: string;
    tableName: string;
    fieldNames: string[];
    fields: Field[];
    ref: Ref;
    dbState: DbState;
    constructor({ tableName, schemaName, fieldNames, relation, token, ref }: {
        tableName: any;
        schemaName: any;
        fieldNames: any;
        relation: any;
        token: any;
        ref: any;
    });
    generateId(): void;
    equals(endpoint: any): boolean;
    compareFields(endpoint: any): boolean;
    export(): {
        schemaName: string;
        tableName: string;
        fieldNames: string[];
        relation: any;
    };
    exportParentIds(): {
        refId: number;
        fieldIds: number[];
    };
    shallowExport(): {
        schemaName: string;
        tableName: string;
        fieldNames: string[];
        relation: any;
    };
    setFields(fieldNames: any, table: any): void;
    normalize(model: NormalizedModel): void;
}
export interface NormalizedEndpoint {
    id: number;
    schemaName: string | null;
    tableName: string;
    fieldNames: string[];
    fieldIds: number[];
    relation: string;
    refId: number;
}

export interface NormalizedEndpointIdMap {
    [_id: number]: NormalizedEndpoint;
}

export default Endpoint;
