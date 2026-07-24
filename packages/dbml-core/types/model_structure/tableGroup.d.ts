import { NormalizedModel } from './database';
import DbState from './dbState';
import Element, { RawNote, Token, Color } from './element';
import Schema from './schema';
import Table from './table';
import type { CustomMetadata } from '@dbml/parse';

export interface RawTableGroup {
    name: string;
    tables: Table[];
    schema: Schema;
    token: Token;
    note: RawNote;
    color: Color;
    metadata?: CustomMetadata;
}

declare class TableGroup extends Element {
    name: string;
    tables: Table[];
    schema: Schema;
    dbState: DbState;
    id: number;
    note: string;
    noteToken: Token;
    color: Color;
    metadata: CustomMetadata;

    constructor({ name, token, tables, schema, note, color, metadata }: RawTableGroup);
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
        color: Color;
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
        color: Color;
        metadata: CustomMetadata;
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedTableGroup {
    id: number;
    name: string;
    note: string | null;
    color: Color;
    tableIds: number[];
    schemaId: number;
    metadata: CustomMetadata;
}

export interface NormalizedTableGroupIdMap {
    [_id: number]: NormalizedTableGroup;
}

export default TableGroup;
