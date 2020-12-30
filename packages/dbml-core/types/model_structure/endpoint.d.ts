import Element from './element';
import Field from './field';
import Ref from './ref';
import DbState from './dbState';
import { NormalizedDatabase } from './database';
declare class Endpoint extends Element {
    relation: any;
    schemaName: String;
    tableName: String;
    fieldNames: String[];
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
        schemaName: String;
        tableName: String;
        fieldNames: String[];
        relation: any;
    };
    exportParentIds(): {
        refId: number;
        fieldIds: number[];
    };
    shallowExport(): {
        schemaName: String;
        tableName: String;
        fieldNames: String[];
        relation: any;
    };
    setFields(fieldNames: any, table: any): void;
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedEndpoint {
    [_id: number]: {
        id: number;
        schemaName: String;
        tableName: String;
        fieldNames: String[];
        relation: any;
        refId: number;
        fieldIds: number[];
    };
}
export default Endpoint;
