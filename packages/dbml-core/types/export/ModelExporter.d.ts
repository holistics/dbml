import Database, { NormalizedDatabase } from '../model_structure/database';
import { SqlDialect } from '@dbml/parse';

export declare type ExportFormatOption = SqlDialect | 'dbml' | 'json';
declare class ModelExporter {
    static export(model: Database | NormalizedDatabase, format: ExportFormatOption, isNormalized?: boolean): string;
}
export default ModelExporter;
