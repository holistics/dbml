import Schema, { RawSchema } from './schema';
import Ref from './ref';
import Enum from './enum';
import TableGroup from './tableGroup';
import Table from './table';
import StickyNote, { NormalizedNote } from './stickyNote';
import Element, { RawNote, Token } from './element';
import DbState from './dbState';
import TablePartial from './tablePartial';
import { NormalizedModel } from './model';
import { RawTableRecord } from './records';
import TableRecord from './records';
import { Filepath, Imports as RawImports, Import as RawImport } from '@dbml/parse';

export interface Project {
    note: RawNote;
    database_type: string;
    name: string;
}

export interface RawFileManifest {
    filepath: Filepath;
    imports: RawImports;
    tables: { name: string; schemaName: string | null }[];
    enums: { name: string; schemaName: string | null }[];
    tableGroups: { name: string; schemaName: string | null }[];
    tablePartials: { name: string }[];
    notes: { name: string }[];
}

export interface RawDatabase {
    schemas: Schema[];
    tables: Table[];
    notes: StickyNote[];
    enums: Enum[];
    refs: Ref[];
    tableGroups: TableGroup[];
    project: Project;
    records: RawTableRecord[];
    tablePartials: TablePartial[];
    files: RawFileManifest[];
}

export interface NormalizedImport {
    name: string;
    schemaName: string | null;
    alias?: string;
    reexport: boolean;
    id: number;
}

export interface NormalizedImports {
  tables: NormalizedImport[];
  tablegroups: NormalizedImport[];
  enums: NormalizedImport[];
  tablepartials: NormalizedImport[];
  notes: NormalizedImport[];
}

export interface NormalizedFileManifest {
  filepath: string;
  tables: { name: string; schemaName: string | null }[];
  enums: { name: string; schemaName: string | null }[];
  tableGroups: { name: string; schemaName: string | null }[];
  tablePartials: { name: string }[];
  notes: { name: string }[];
  imports: NormalizedImports;
}

declare class Database extends Element {
    dbState: DbState;
    hasDefaultSchema: boolean;
    schemas: Schema[];
    notes: StickyNote[];
    note: string;
    noteToken: Token;
    databaseType: string;
    name: string;
    records: TableRecord[];
    id: number;
    constructor({ schemas, tables, enums, refs, tableGroups, project, records }: RawDatabase);
    generateId(): void;
    processRecords(rawRecords: RawTableRecord[]): void;
    processSchemas(rawSchemas: RawSchema[]): void;
    pushSchema(schema: Schema): void;
    checkSchema(schema: Schema): void;
    processSchemaElements(elements: Schema[] | Table[] | Enum[] | TableGroup[] | Ref[], elementType: any): void;
    findOrCreateSchema(schemaName: string): Schema;
    findTable(rawTable: any): Table;
    processTablePartials(rawTablePartials: any[]): TablePartial[];
    findTablePartial(partialName: string): TablePartial;
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
        notes: {
            id: number;
            name: string;
            content: string;
            headerColor: string;
        }[];
        records: {
            id: number;
            schemaName: string;
            tableName: string;
            columns: string[];
            values: {
                value: any;
                type: string;
            }[][];
        }[];
        tablePartials: {
            name: string;
            note: string;
            headerColor: string;
            fields: {
                name: string;
                type: any;
                unique: boolean;
                pk: boolean;
                not_null: boolean;
                note: string;
                dbdefault: any;
                increment: boolean;
                injectedPartialId: number | undefined,
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
        notes: {
            id: number;
            name: string;
            content: string;
            headerColor: string;
        }[];
        tablePartials: {
            name: string;
            note: string;
            headerColor: string;
            fields: {
                name: string;
                type: any;
                unique: boolean;
                pk: boolean;
                not_null: boolean;
                note: string;
                dbdefault: any;
                increment: boolean;
                injectedPartialId: number | undefined,
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
        }[];
    };
    exportChildIds(): {
        schemaIds: number[];
        noteIds: number[];
    };
    normalize(): NormalizedModel;
}
export interface NormalizedDatabase {
    id: number;
    filepath?: string;
    hasDefaultSchema: boolean;
    note: string | null;
    databaseType: string;
    name: string;
    schemaIds: number[];
    noteIds: number[];
}

export interface NormalizedDatabaseIdMap {
    [_id: number]: NormalizedDatabase;
}

export default Database;
