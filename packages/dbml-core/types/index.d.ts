import ModelExporter from './export/ModelExporter';
import Parser from './parse/Parser';
import importer from './import';
import exporter from './export';
import { renameTable } from './transform';
export { renameTable, importer, exporter, ModelExporter, Parser };
export { CompilerDiagnostic, CompilerError as CompilerDiagnostics, EditorPosition, ErrorCode, WarningLevel, } from './parse/error';

// Export model structure classes and types
export {
    Database,
    Schema,
    Table,
    Field,
    Index,
    IndexColumn,
    Enum,
    EnumValue,
    Ref,
    Endpoint,
    TableGroup,
    StickyNote,
    Check,
    TablePartial,
} from './model_structure';

// Export normalized types
export type {
    NormalizedDatabase,
    NormalizedDatabaseIdMap,
    NormalizedModel,
    NormalizedSchema,
    NormalizedSchemaIdMap,
    NormalizedTable,
    NormalizedTableIdMap,
    NormalizedField,
    NormalizedFieldIdMap,
    NormalizedIndex,
    NormalizedIndexIdMap,
    NormalizedIndexColumn,
    NormalizedIndexColumnIdMap,
    NormalizedEnum,
    NormalizedEnumIdMap,
    NormalizedEnumValue,
    NormalizedEnumValueIdMap,
    NormalizedRef,
    NormalizedRefIdMap,
    NormalizedEndpoint,
    NormalizedEndpointIdMap,
    NormalizedTableGroup,
    NormalizedTableGroupIdMap,
    NormalizedNote,
    NormalizedNoteIdMap,
    Project,
    RawDatabase,
    TableRecord,
    NormalizedRecords,
    RawSchema,
} from './model_structure';
