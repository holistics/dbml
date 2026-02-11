import Database, { NormalizedModel } from '../model_structure/database';

export declare type ExportFormatOption = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';
declare class ModelExporter {
    static export(model: Database | NormalizedModel, format: ExportFormatOption, isNormalized?: boolean): string;
}
export default ModelExporter;
