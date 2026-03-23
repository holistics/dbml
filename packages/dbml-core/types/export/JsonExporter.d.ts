import type Database from '../model_structure/database';
import type Model from '../model_structure/model';
import type { NormalizedModel } from '../model_structure/model';

export interface JsonExporterOptions {
    /** When false, the model is exported via its `.export()` method before stringifying. Defaults to true. */
    isNormalized: boolean;
}

declare class JsonExporter {
    static export(model: Database | Model | NormalizedModel, options: JsonExporterOptions): string;
}

export default JsonExporter;
