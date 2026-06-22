import Element, { RawNote, Token, Color } from './element';
import Field from './field';
import Index from './indexes';
import Check from './check';
import Schema from './schema';
import DbState from './dbState';
import TableGroup from './tableGroup';
import TablePartial from './tablePartial';
import { NormalizedModel, TableRecord } from './database';

export interface RawTable {
    name: string;
    alias: string;
    note: RawNote;
    fields: Field[];
    indexes: Index[];
    checks?: any[];
    schema: Schema;
    token: Token;
    headerColor: Color;
    partials: TablePartial[];
}

declare class Table extends Element {
    name: string;
    alias: string;
    note: string;
    noteToken: Token;
    fields: Field[];
    indexes: Index[];
    checks: Check[];
    schema: Schema;
    headerColor: Color;
    dbState: DbState;
    id: number;
    group: TableGroup;
    partials: TablePartial[];
    records: TableRecord[];

    constructor({ name, alias, note, fields, indexes, checks, schema, token, headerColor }: RawTable);
    generateId(): void;
    processFields(rawFields: any): void;
    pushField(field: any): void;
    checkField(field: any): void;
    processIndexes(rawIndexes: any): void;
    pushIndex(index: any): void;
    checkIndex(index: any): void;
    processChecks(checks: any[]): void;
    pushCheck(check: any): void;
    findField(fieldName: any): Field;
    checkSameId(table: any): boolean;
    processPartials(): void;
    export(): {
        fields: {
            name: string;
            type: any;
            unique: boolean;
            pk: boolean;
            not_null: boolean;
            note: string;
            dbdefault: any;
            increment: boolean;
        }[];
        indexes: {
            columns: {
                type: any;
                value: any;
            }[];
            name: string;
            type: any;
            unique: boolean;
            pk: string;
            note: string;
        }[];
        name: string;
        alias: string;
        note: string;
        headerColor: Color;
        partials: TablePartial[];
    };
    exportChild(): {
        fields: {
            name: string;
            type: any;
            unique: boolean;
            pk: boolean;
            not_null: boolean;
            note: string;
            dbdefault: any;
            increment: boolean;
        }[];
        indexes: {
            columns: {
                type: any;
                value: any;
            }[];
            name: string;
            type: any;
            unique: boolean;
            pk: string;
            note: string;
        }[];
    };
    exportChildIds(): {
        fieldIds: number[];
        indexIds: number[];
        checkIds: number[];
    };
    exportParentIds(): {
        schemaId: number;
        groupId: number;
    };
    shallowExport(): {
        name: string;
        alias: string;
        note: string;
        headerColor: Color;
        partials: TablePartial[];
        recordIds: number[];
    };
    normalize(model: NormalizedModel): void;
}

export interface NormalizedTable {
    id: number;
    name: string;
    alias: string | null;
    note: string | null;
    headerColor: Color;
    fieldIds: number[];
    indexIds: number[];
    checkIds: number[];
    recordIds: number[];
    schemaId: number;
    groupId: number | null;
    partials: TablePartial[];
    metadataIds: number[];
    metadata: { [key: string]: unknown };
}

export interface NormalizedTableIdMap {
    [id: number]: NormalizedTable;
}

export default Table;
