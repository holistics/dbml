import Database from './database';
import { Token } from './element';
import { NormalizedSchemaIdMap } from './schema';
import { NormalizedRefIdMap } from './ref';
import { NormalizedEnumIdMap } from './enum';
import { NormalizedTableGroupIdMap } from './tableGroup';
import { NormalizedTableIdMap } from './table';
import { NormalizedNoteIdMap } from './stickyNote';
import { NormalizedEndpointIdMap } from './endpoint';
import { NormalizedEnumValueIdMap } from './enumValue';
import { NormalizedFieldIdMap } from './field';
import { NormalizedIndexColumnIdMap } from './indexColumn';
import { NormalizedIndexIdMap } from './indexes';
import { NormalizedCheckIdMap } from './check';
import { NormalizedTablePartialIdMap } from './tablePartial';
import { NormalizedRecordIdMap, RawDatabase } from './database';
import DbState from './dbState';

export interface RawModel {
    database: RawDatabase[];
}

declare class Model {
    dbState: DbState;
    database: Database[];

    constructor({ database }: RawModel);
    normalize(): NormalizedModel;
}

export interface NormalizedDatabase {
    id: number;
    token: Token;
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

export interface NormalizedModel {
    database: NormalizedDatabaseIdMap;
    schemas: NormalizedSchemaIdMap;
    endpoints: NormalizedEndpointIdMap;
    refs: NormalizedRefIdMap;
    fields: NormalizedFieldIdMap;
    tables: NormalizedTableIdMap;
    tableGroups: NormalizedTableGroupIdMap;
    enums: NormalizedEnumIdMap;
    enumValues: NormalizedEnumValueIdMap;
    indexes: NormalizedIndexIdMap;
    indexColumns: NormalizedIndexColumnIdMap;
    notes: NormalizedNoteIdMap;
    checks: NormalizedCheckIdMap;
    tablePartials: NormalizedTablePartialIdMap;
    records: NormalizedRecordIdMap;
}

export default Model;
