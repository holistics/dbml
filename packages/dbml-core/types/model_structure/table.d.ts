import Element, { Token } from './element';
import Field from './field';
import Index from './indexes';
import Schema from './schema';
import DbState from './dbState';
import TableGroup from './tableGroup';
import { NormalizedDatabase } from './database';
interface RawTable {
    name: String;
    alias: String;
    note: String;
    fields: Field[];
    indexes: Index[];
    schema: Schema;
    token: Token;
    headerColor: String;
}
declare class Table extends Element {
    name: String;
    alias: String;
    note: String;
    fields: Field[];
    indexes: Index[];
    schema: Schema;
    headerColor: String;
    dbState: DbState;
    id: number;
    group: TableGroup;
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
    export(): {
        fields: {
            name: String;
            type: any;
            unique: boolean;
            pk: boolean;
            not_null: boolean;
            note: String;
            dbdefault: any;
            increment: boolean;
        }[];
        indexes: {
            columns: {
                type: any;
                value: any;
            }[];
            name: String;
            type: any;
            unique: boolean;
            pk: String;
            note: String;
        }[];
        name: String;
        alias: String;
        note: String;
        headerColor: String;
    };
    exportChild(): {
        fields: {
            name: String;
            type: any;
            unique: boolean;
            pk: boolean;
            not_null: boolean;
            note: String;
            dbdefault: any;
            increment: boolean;
        }[];
        indexes: {
            columns: {
                type: any;
                value: any;
            }[];
            name: String;
            type: any;
            unique: boolean;
            pk: String;
            note: String;
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
        name: String;
        alias: String;
        note: String;
        headerColor: String;
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedTable {
    [id: number]: {
        id: number;
        name: String;
        alias: String;
        note: String;
        headerColor: String;
        fieldIds: number[];
        indexIds: number[];
        schemaId: number;
        groupId: number;
    };
}
export default Table;
