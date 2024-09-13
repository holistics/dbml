import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { RawNote, Token} from './element';
import Schema from './schema';
import Table from './table';

interface RawTableGroup {
    name: string;
    tables: Table[];
    schema: Schema;
    token: Token;
    note: RawNote;
    color: string;
}

declare class TableGroup extends Element {
    name: string;
    tables: Table[];
    schema: Schema;
    dbState: DbState;
    id: number;
    note: string;
    noteToken: Token;
    color: string;
    constructor({ name, token, tables, schema, note, color }: RawTableGroup);
    generateId(): void;
    processTables(rawTables: any): void;
    pushTable(table: any): void;
    checkTable(table: any): void;
    export(): {
        tables: {
            tableName: string;
            schemaName: string;
        }[];
        name: string;
        note: string;
        color: string;
    };
    exportChild(): {
        tables: {
            tableName: string;
            schemaName: string;
        }[];
    };
    exportChildIds(): {
        tableIds: number[];
    };
    exportParentIds(): {
        schemaId: number;
    };
    shallowExport(): {
        name: string;
        note: string;
        color: string;
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedTableGroup {
    [_id: number]: {
        id: number;
        name: string;
        tableIds: number[];
        schemaId: number;
        note: string;
        color: string;
    };
}
export default TableGroup;
