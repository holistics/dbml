import { NormalizedModel } from './database';
import DbState from './dbState';
import Element, { RawNote, Token } from './element';
import Schema, { RawSchema } from './schema';
import Table, { RawTable } from './table';

export interface RawTableGroup {
    name: string | null;
    schemaName: string | null;
    tables: Array<{ name: string; schemaName: string | null }>;
    token: Token;
    color?: string;
    note?: RawNote;
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
    constructor({ name, token, tables, schema, note, color, noteToken }: RawTableGroup & {
        schema: Schema;
    });
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
    normalize(model: NormalizedModel): void;
}
export interface NormalizedTableGroup {
    id: number;
    name: string;
    note: string | null;
    color: string;
    tableIds: number[];
    schemaId: number;
}

export interface NormalizedTableGroupIdMap {
    [_id: number]: NormalizedTableGroup;
}

export default TableGroup;
