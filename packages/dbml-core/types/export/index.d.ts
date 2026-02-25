import type { DbmlExporterOptions } from './DbmlExporter';
import type { JsonExporterOptions } from './JsonExporter';

export type ExportFormat = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';

export type ExportOptions =
  Partial<DbmlExporterOptions> &
  Partial<JsonExporterOptions>;

declare function _export(str: string, format: ExportFormat, options: boolean): string;
declare function _export(str: string, format: ExportFormat, options?: ExportOptions): string;

declare const _default: {
    export: typeof _export;
};
export default _default;
