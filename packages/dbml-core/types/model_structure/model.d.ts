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
import { NormalizedRecordIdMap, NormalizedDatabaseIdMap, NormalizedFileManifest } from './database';

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
    files: NormalizedFileManifest[];
}
