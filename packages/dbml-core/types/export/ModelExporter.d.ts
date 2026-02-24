import Database, { NormalizedModel } from '../model_structure/database';

export declare type ExportFormatOption = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';
export interface ExportFlags {
    isNormalized?: boolean;
    includeRecords?: boolean;
}
declare class ModelExporter {
    /**
     * @deprecated Passing a boolean as the third argument is deprecated. Use `{ isNormalized: boolean }` instead.
     */
    static export(model: Database | NormalizedModel, format: ExportFormatOption, isNormalized: boolean): string;
    static export(model: Database | NormalizedModel, format: ExportFormatOption, flags?: ExportFlags): string;
}
export default ModelExporter;
