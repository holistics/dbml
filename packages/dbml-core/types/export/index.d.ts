import type { DbmlExporterFlags } from './DbmlExporter';
import type { JsonExporterFlags } from './JsonExporter';

export type ExportFormatOption = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';

export type ExportFlags =
  Partial<DbmlExporterFlags> &
  Partial<JsonExporterFlags>;

declare function _export(str: string, format: ExportFormatOption, flags: boolean): string;
declare function _export(str: string, format: ExportFormatOption, flags?: ExportFlags): string;

declare const _default: {
    export: typeof _export;
};
export default _default;
