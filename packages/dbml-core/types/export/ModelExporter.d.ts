import type Database from '../model_structure/database';
import type { NormalizedModel } from '../model_structure/database';
import type { ExportFormatOption, ExportFlags } from './index';

declare class ModelExporter {
    /**
     * @deprecated Passing a boolean as the third argument is deprecated. Use `ExportFlags` instead.
     */
    static export(model: Database | NormalizedModel, format: ExportFormatOption, flags: boolean): string;
    static export(model: Database | NormalizedModel, format: ExportFormatOption, flags?: ExportFlags): string;
}

export default ModelExporter;
