// Export main classes
export { default as Database } from './database';
export { default as Schema } from './schema';
export { default as Table } from './table';
export { default as Field } from './field';
export { default as Index } from './indexes';
export { default as IndexColumn } from './indexColumn';
export { default as Enum } from './enum';
export { default as EnumValue } from './enumValue';
export { default as Ref } from './ref';
export { default as Endpoint } from './endpoint';
export { default as TableGroup } from './tableGroup';
export { default as StickyNote } from './stickyNote';
export { default as Check } from './check';
export { default as TablePartial } from './tablePartial';

// Export normalized individual types
export type {
    NormalizedDatabase,
    NormalizedDatabaseIdMap,
    NormalizedModel,
} from './database';

export type {
    NormalizedSchema,
    NormalizedSchemaIdMap,
} from './schema';

export type {
    NormalizedTable,
    NormalizedTableIdMap,
} from './table';

export type {
    NormalizedField,
    NormalizedFieldIdMap,
} from './field';

export type {
    NormalizedIndex,
    NormalizedIndexIdMap,
} from './indexes';

export type {
    NormalizedIndexColumn,
    NormalizedIndexColumnIdMap,
} from './indexColumn';

export type {
    NormalizedEnum,
    NormalizedEnumIdMap,
} from './enum';

export type {
    NormalizedEnumValue,
    NormalizedEnumValueIdMap,
} from './enumValue';

export type {
    NormalizedRef,
    NormalizedRefIdMap,
} from './ref';

export type {
    NormalizedEndpoint,
    NormalizedEndpointIdMap,
} from './endpoint';

export type {
    NormalizedTableGroup,
    NormalizedTableGroupIdMap,
} from './tableGroup';

export type {
    NormalizedNote,
    NormalizedNoteIdMap,
} from './stickyNote';

export type {
    NormalizedTablePartial,
    NormalizedTablePartialIdMap,
} from './tablePartial';

export type {
    NormalizedCheck,
    NormalizedCheckIdMap,
} from './check';

// Export other types
export type { Project, RawDatabase, TableRecord, NormalizedRecords } from './database';
export type { RawSchema } from './schema';
