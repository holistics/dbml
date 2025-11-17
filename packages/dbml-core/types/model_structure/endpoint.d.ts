import Element from './element';
import Field from './field';
import Ref from './ref';
import DbState from './dbState';
import { NormalizedDatabase } from './database';
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
