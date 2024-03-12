import Database, { NormalizedDatabase } from '../model_structure/database';

export type ExportFormatOptions = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';
declare class ModelExporter {
    static export(model: Database | NormalizedDatabase, format: ExportFormatOptions, isNormalized?: boolean): string;
}
export default ModelExporter;
