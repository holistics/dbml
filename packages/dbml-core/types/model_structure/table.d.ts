import Element, { RawNote, Token } from './element';
import Field from './field';
import Index from './indexes';
import Schema from './schema';
import DbState from './dbState';
import TableGroup from './tableGroup';
import TablePartial from './tablePartial';
import { NormalizedDatabase } from './database';

interface RawTable {
    name: string;
    alias: string;
    note: RawNote;
    fields: Field[];
    indexes: Index[];
    schema: Schema;
    token: Token;
    headerColor: string;
    partials: TablePartial[];
}

declare class Table extends Element {
    name: string;
    alias: string;
    note: string;
    noteToken: Token;
    fields: Field[];
    indexes: Index[];
    schema: Schema;
    headerColor: string;
    dbState: DbState;
    id: number;
    group: TableGroup;
    partials: TablePartial[];

    constructor({ name, alias, note, fields, indexes, schema, token, headerColor }: RawTable);
    generateId(): void;
    processFields(rawFields: any): void;
    pushField(field: any): void;
    checkField(field: any): void;
    processIndexes(rawIndexes: any): void;
    pushIndex(index: any): void;
    checkIndex(index: any): void;
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
        headerColor: string;
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
    };
    exportParentIds(): {
        schemaId: number;
        groupId: number;
    };
    shallowExport(): {
        name: string;
        alias: string;
        note: string;
        headerColor: string;
        partials: TablePartial[];
    };
    normalize(model: NormalizedDatabase): void;
}

export interface NormalizedTable {
    [id: number]: {
        id: number;
        name: string;
        alias: string;
        note: string;
        headerColor: string;
        fieldIds: number[];
        indexIds: number[];
        schemaId: number;
        groupId: number;
        partials: TablePartial[];
    };
}

export default Table;
