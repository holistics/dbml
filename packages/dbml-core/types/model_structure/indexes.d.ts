import { NormalizedModel } from './database';
import DbState from './dbState';
import Element, { RawNote, Token } from './element';
import IndexColumn from './indexColumn';
import Table from './table';
import TablePartial from './tablePartial';
interface RawIndex {
    columns: IndexColumn;
    type: any;
    unique: boolean;
    pk: string;
    name: string;
    note: RawNote;
    table: Table;
    token: Token;
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
    constructor({ columns, type, unique, pk, token, name, note, table }: RawIndex);
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
    normalize(model: NormalizedModel): void;
}
export interface NormalizedIndex {
    id: number;
    name: string | null;
    unique: boolean;
    pk: false;
    note: string | null;
    columnIds: number[];
    tableId: number;
}

export interface NormalizedIndexIdMap {
    [_id: number]: NormalizedIndex;
}

export default Index;
