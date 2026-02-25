import type Database from '../model_structure/database';
import type { NormalizedModel } from '../model_structure/database';

export interface JsonExporterFlags {
    /** When false, the model is exported via its `.export()` method before stringifying. Defaults to true. */
    isNormalized: boolean;
}

declare class JsonExporter {
    static export(model: Database | NormalizedModel, flags: JsonExporterFlags): string;
}

export default JsonExporter;
