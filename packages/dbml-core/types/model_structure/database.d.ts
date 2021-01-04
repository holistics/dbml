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
    note: string;
    database_type: string;
    name: string;
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
    note: string;
    databaseType: string;
    name: string;
    id: number;
    constructor({ schemas, tables, enums, refs, tableGroups, project }: RawDatabase);
    generateId(): void;
    processSchemas(rawSchemas: RawSchema[]): void;
    pushSchema(schema: Schema): void;
    checkSchema(schema: Schema): void;
    processSchemaElements(elements: Schema[] | Table[] | Enum[] | TableGroup[] | Ref[], elementType: any): void;
    findOrCreateSchema(schemaName: string): Schema;
    findTable(rawTable: any): Table;
    export(): {
        schemas: {
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
        }[];
    };
    shallowExport(): {
        hasDefaultSchema: boolean;
        note: string;
        databaseType: string;
        name: string;
    };
    exportChild(): {
        schemas: {
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
            note: string;
            databaseType: string;
            name: string;
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
