import Table from './table';
import Element, { Token } from './element';
import Enum from './enum';
import TableGroup from './tableGroup';
import Ref from './ref';
import Database, { NormalizedDatabase } from './database';
import DbState from './dbState';
export interface RawSchema {
    name: string;
    alias?: string;
    note?: string;
    tables?: Table[];
    refs?: Ref[];
    enums?: Enum[];
    tableGroups?: TableGroup[];
    token?: Token;
    database: Database;
}
declare class Schema extends Element {
    name: string;
    alias: string;
    note: string;
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
    findTable(tableName: string): Table;
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
        }[];
        enums: {
            values: {
                name: string;
                note: string;
            }[];
            name: string;
            note: string;
        }[];
        tableGroups: {
            tables: {
                tableName: string;
                schemaName: string;
            }[];
            name: string;
        }[];
        refs: {
            endpoints: {
                schemaName: string;
                tableName: string;
                fieldNames: string[];
                relation: any;
            }[];
            name: string;
            onDelete: any;
            onUpdate: any;
        }[];
        name: string;
        note: string;
        alias: string;
    };
    exportChild(): {
        tables: {
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
        }[];
        enums: {
            values: {
                name: string;
                note: string;
            }[];
            name: string;
            note: string;
        }[];
        tableGroups: {
            tables: {
                tableName: string;
                schemaName: string;
            }[];
            name: string;
        }[];
        refs: {
            endpoints: {
                schemaName: string;
                tableName: string;
                fieldNames: string[];
                relation: any;
            }[];
            name: string;
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
        name: string;
        note: string;
        alias: string;
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedSchema {
    [_id: number]: {
        id: number;
        name: string;
        note: string;
        alias: string;
        tableIds: number[];
        enumIds: number[];
        tableGroupIds: number[];
        refIds: number[];
        databaseId: number;
    };
}
export default Schema;
