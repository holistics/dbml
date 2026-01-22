import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { RawNote, Token } from './element';
import IndexColumn from './indexColumn';
import Table from './table';
import TablePartial from './tablePartial';
export interface RawIndex {
    columns: Array<{
        value: string;
        type: string;
        token: Token;
    }>;
    token: Token;
    unique?: boolean;
    pk?: boolean;
    name?: string;
    type?: string;
    note?: RawNote;
}
declare class Index extends Element {
    columns: IndexColumn[];
    type: any;
    unique: boolean;
    pk: string;
    name: string;
    note: string;
    noteToken: Token;
    table: Table;
    dbState: DbState;
    injectedPartial: TablePartial;
    constructor({ columns, type, unique, pk, token, name, note, table }: RawIndex & {
        table: Table;
        injectedPartial: TablePartial;
    });
    generateId(): void;
    processIndexColumns(rawColumns: any): void;
    pushIndexColumn(column: any): void;
    checkIndexColumn(column: any): void;
    export(): {
        columns: {
            type: any;
            value: any;
        }[];
        name: string;
        type: any;
        unique: boolean;
        pk: string;
        note: string;
        injectedPartialId?: number;
    };
    exportChild(): {
        columns: {
            type: any;
            value: any;
        }[];
    };
    exportChildIds(): {
        columnIds: number[];
    };
    exportParentIds(): {
        tableId: number;
    };
    shallowExport(): {
        name: string;
        type: any;
        unique: boolean;
        pk: string;
        note: string;
        injectedPartialId?: number;
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedIndex {
    [_id: number]: {
        id: number;
        name: string;
        type: any;
        unique: boolean;
        pk: string;
        note: string;
        columnIds: number[];
        tableId: number;
    };
}
export default Index;
