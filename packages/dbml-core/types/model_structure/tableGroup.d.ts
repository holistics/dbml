import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element from './element';
import Schema from './schema';
import Table from './table';
declare class TableGroup extends Element {
    name: String;
    tables: Table[];
    schema: Schema;
    dbState: DbState;
    id: number;
    constructor({ name, token, tables, schema }: {
        name: any;
        token: any;
        tables?: any[];
        schema: any;
    });
    generateId(): void;
    processTables(rawTables: any): void;
    pushTable(table: any): void;
    checkTable(table: any): void;
    export(): {
        tables: {
            tableName: String;
            schemaName: String;
        }[];
        name: String;
    };
    exportChild(): {
        tables: {
            tableName: String;
            schemaName: String;
        }[];
    };
    exportChildIds(): {
        tableIds: number[];
    };
    exportParentIds(): {
        schemaId: number;
    };
    shallowExport(): {
        name: String;
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedTableGroup {
    [_id: number]: {
        id: number;
        name: String;
        tableIds: number[];
        schemaId: number;
    };
}
export default TableGroup;
