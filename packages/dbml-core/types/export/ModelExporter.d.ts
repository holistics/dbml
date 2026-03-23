import type Database from '../model_structure/database';
import type Model from '../model_structure/model';
import type { NormalizedModel } from '../model_structure/model';
import type { ExportFormat, ExportOptions } from './index';

declare class ModelExporter {
    /**
     * @deprecated Passing a boolean as the third argument is deprecated. Use `ExportOptions` instead.
     */
    static export(model: Database | Model | NormalizedModel, format: ExportFormat, options: boolean): string;
    static export(model: Database | Model | NormalizedModel, format: ExportFormat, options?: ExportOptions): string;
}

export default ModelExporter;
