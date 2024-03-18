import Database, { NormalizedDatabase } from '../model_structure/database';

export type ExportFormatOption = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';
declare class ModelExporter {
    static export(model: Database | NormalizedDatabase, format: ExportFormatOption, isNormalized?: boolean): string;
}
export default ModelExporter;
