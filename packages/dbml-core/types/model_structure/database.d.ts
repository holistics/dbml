import Schema, { NormalizedSchema, RawSchema } from './schema';
import Ref, { NormalizedRef, RawRef } from './ref';
import Enum, { NormalizedEnum, RawEnum } from './enum';
import TableGroup, { NormalizedTableGroup, RawTableGroup } from './tableGroup';
import Table, { NormalizedTable, RawTable } from './table';
import StickyNote, { NormalizedStickyNote, RawStickyNote } from './stickyNote';
import Element, { RawNote, Token } from './element';
import DbState from './dbState';
import { NormalizedEndpoint } from './endpoint';
import { NormalizedEnumValue } from './enumValue';
import { NormalizedField } from './field';
import { NormalizedIndexColumn } from './indexColumn';
import { NormalizedIndex } from './indexes';
import { NormalizedCheck } from './check';
import TablePartial, { NormalizedTablePartial, RawTablePartial } from './tablePartial';
export interface Project {
    note?: RawNote;
    database_type?: string | null;
    name?: string | null;
}

export type RecordValueType = 'string' | 'bool' | 'integer' | 'real' | 'date' | 'time' | 'datetime' | string;

export interface RawTableRecord {
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

export interface Alias {
    name: string;
    kind: 'table';
    value: {
        tableName: string;
        schemaName: string | null;
    };
}

export interface RawDatabase {
    schemas: [];
    tables: RawTable[];
    notes: RawStickyNote[];
    refs: RawRef[];
    enums: RawEnum[];
    tableGroups: RawTableGroup[];
    aliases: Alias[];
    project: Project;
    tablePartials: RawTablePartial[];
    records: RawTableRecord[];
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
    aliases: any[];
    records: TableRecord[];
    tablePartials: TablePartial[];
    id: number;
    constructor({ schemas, tables, notes, enums, refs, tableGroups, project, aliases, records, tablePartials }: RawDatabase);
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
    checks: NormalizedCheck;
    fields: NormalizedField;
    records: NormalizedRecords;
    tablePartials: NormalizedTablePartial;
}
export default Database;
