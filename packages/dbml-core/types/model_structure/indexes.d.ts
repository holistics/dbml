import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { Token } from './element';
import IndexColumn from './indexColumn';
import Table from './table';
interface RawIndex {
    columns: IndexColumn;
    type: any;
    unique: boolean;
    pk: string;
    name: string;
    note: string;
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
    table: Table;
    dbState: DbState;
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
