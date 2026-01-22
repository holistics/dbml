import Element, { Token } from './element';
import Field from './field';
import Ref from './ref';
import DbState from './dbState';
import { NormalizedDatabase } from './database';

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
    constructor({ tableName, schemaName, fieldNames, relation, token, ref }: RawEndpoint & {
        ref: Ref;
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
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedEndpoint {
    [_id: number]: {
        id: number;
        schemaName: string;
        tableName: string;
        fieldNames: string[];
        relation: any;
        refId: number;
        fieldIds: number[];
    };
}
export default Endpoint;
