import Schema, { NormalizedSchema, RawSchema } from './schema';
import Ref, { NormalizedRef } from './ref';
import Enum, { NormalizedEnum } from './enum';
import TableGroup, { NormalizedTableGroup } from './tableGroup';
import Table, { NormalizedTable } from './table';
import StickyNote, { NormalizedStickyNote } from './stickyNote';
import Element, { RawNote, Token } from './element';
import DbState from './dbState';
import { NormalizedEndpoint } from './endpoint';
import { NormalizedEnumValue } from './enumValue';
import { NormalizedField } from './field';
import { NormalizedIndexColumn } from './indexColumn';
import { NormalizedIndex } from './indexes';
import TablePartial, { NormalizedTablePartial } from './tablePartial';
export interface Project {
    note: RawNote;
    database_type: string;
    name: string;
}

interface RawTableRecord {
    schemaName: string | undefined;
    tableName: string;
    columns: string[];
    values: {
        value: any;
        type: string;
    }[][];
}

export interface TableRecord extends RawTableRecord {
    id: number;
}

export interface NormalizedRecords {
    [_id: number]: TableRecord;
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
            noteIds: number[];
        };
    };
    schemas: NormalizedSchema;
    notes: NormalizedStickyNote;
    refs: NormalizedRef;
    enums: NormalizedEnum;
    tableGroups: NormalizedTableGroup;
    tables: NormalizedTable;
    endpoints: NormalizedEndpoint;
    enumValues: NormalizedEnumValue;
    indexes: NormalizedIndex;
    indexColumns: NormalizedIndexColumn;
    fields: NormalizedField;
    records: NormalizedRecords;
    tablePartials: NormalizedTablePartial;
}
export default Database;
