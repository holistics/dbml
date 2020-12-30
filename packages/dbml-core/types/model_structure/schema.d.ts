import Table from './table';
import Element, { Token } from './element';
import Enum from './enum';
import TableGroup from './tableGroup';
import Ref from './ref';
import Database, { NormalizedDatabase } from './database';
import DbState from './dbState';
export interface RawSchema {
    name: String;
    alias?: String;
    note?: String;
    tables?: Table[];
    refs?: Ref[];
    enums?: Enum[];
    tableGroups?: TableGroup[];
    token?: Token;
    database: Database;
}
declare class Schema extends Element {
    name: String;
    alias: String;
    note: String;
    tables: Table[];
    refs: Ref[];
    enums: Enum[];
    tableGroups: TableGroup[];
    database: Database;
    dbState: DbState;
    constructor({ name, alias, note, tables, refs, enums, tableGroups, token, database }: RawSchema);
    generateId(): void;
    processTables(rawTables: any): void;
    pushTable(table: any): void;
    checkTable(table: any): void;
    findTable(tableName: String): Table;
    processEnums(rawEnums: any): void;
    pushEnum(_enum: any): void;
    checkEnum(_enum: any): void;
    bindEnumToField(_enum: any): void;
    processRefs(rawRefs: any): void;
    pushRef(ref: any): void;
    checkRef(ref: any): void;
    processTableGroups(rawTableGroups: any): void;
    pushTableGroup(tableGroup: any): void;
    checkTableGroup(tableGroup: any): void;
    checkSameId(schema: any): boolean;
    export(): {
        tables: {
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
        }[];
        enums: {
            values: {
                name: String;
                note: String;
            }[];
            name: String;
            note: String;
        }[];
        tableGroups: {
            tables: {
                tableName: String;
                schemaName: String;
            }[];
            name: String;
        }[];
        refs: {
            endpoints: {
                schemaName: String;
                tableName: String;
                fieldNames: String[];
                relation: any;
            }[];
            name: String;
            onDelete: any;
            onUpdate: any;
        }[];
        name: String;
        note: String;
        alias: String;
    };
    exportChild(): {
        tables: {
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
        }[];
        enums: {
            values: {
                name: String;
                note: String;
            }[];
            name: String;
            note: String;
        }[];
        tableGroups: {
            tables: {
                tableName: String;
                schemaName: String;
            }[];
            name: String;
        }[];
        refs: {
            endpoints: {
                schemaName: String;
                tableName: String;
                fieldNames: String[];
                relation: any;
            }[];
            name: String;
            onDelete: any;
            onUpdate: any;
        }[];
    };
    exportChildIds(): {
        tableIds: number[];
        enumIds: number[];
        tableGroupIds: number[];
        refIds: number[];
    };
    exportParentIds(): {
        databaseId: number;
    };
    shallowExport(): {
        name: String;
        note: String;
        alias: String;
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedSchema {
    [_id: number]: {
        id: number;
        name: String;
        note: String;
        alias: String;
        tableIds: number[];
        enumIds: number[];
        tableGroupIds: number[];
        refIds: number[];
        databaseId: number;
    };
}
export default Schema;
