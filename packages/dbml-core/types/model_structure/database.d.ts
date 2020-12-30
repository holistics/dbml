import Schema, { NormalizedSchema, RawSchema } from './schema';
import Ref, { NormalizedRef } from './ref';
import Enum, { NormalizedEnum } from './enum';
import TableGroup, { NormalizedTableGroup } from './tableGroup';
import Table, { NormalizedTable } from './table';
import Element from './element';
import DbState from './dbState';
import { NormalizedEndpoint } from './endpoint';
import { NormalizedEnumValue } from './enumValue';
import { NormalizedField } from './field';
import { NormalizedIndexColumn } from './indexColumn';
import { NormalizedIndex } from './indexes';
export interface Project {
    note: String;
    database_type: String;
    name: String;
}
export interface RawDatabase {
    schemas: Schema[];
    tables: Table[];
    enums: Enum[];
    refs: Ref[];
    tableGroups: TableGroup[];
    project: Project;
}
declare class Database extends Element {
    dbState: DbState;
    hasDefaultSchema: boolean;
    schemas: Schema[];
    note: String;
    databaseType: String;
    name: String;
    id: number;
    constructor({ schemas, tables, enums, refs, tableGroups, project }: RawDatabase);
    generateId(): void;
    processSchemas(rawSchemas: RawSchema[]): void;
    pushSchema(schema: Schema): void;
    checkSchema(schema: Schema): void;
    processSchemaElements(elements: Schema[] | Table[] | Enum[] | TableGroup[] | Ref[], elementType: any): void;
    findOrCreateSchema(schemaName: String): Schema;
    findTable(rawTable: any): Table;
    export(): {
        schemas: {
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
        }[];
    };
    shallowExport(): {
        hasDefaultSchema: boolean;
        note: String;
        databaseType: String;
        name: String;
    };
    exportChild(): {
        schemas: {
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
        }[];
    };
    exportChildIds(): {
        schemaIds: number[];
    };
    normalize(): NormalizedDatabase;
}
export interface NormalizedDatabase {
    database: {
        [_id: number]: {
            id: number;
            hasDefaultSchema: boolean;
            note: String;
            databaseType: String;
            name: String;
            schemaIds: number[];
        };
    };
    schemas: NormalizedSchema;
    refs: NormalizedRef;
    enums: NormalizedEnum;
    tableGroups: NormalizedTableGroup;
    tables: NormalizedTable;
    endpoints: NormalizedEndpoint;
    enumValues: NormalizedEnumValue;
    indexes: NormalizedIndex;
    indexColumns: NormalizedIndexColumn;
    fields: NormalizedField;
}
export default Database;
