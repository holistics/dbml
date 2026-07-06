import Database from '../model_structure/database';
import type { NormalizedModel } from '../../types/model_structure/database';

export interface JsonExporterOptions {
  /** When false, the model is exported via its `.export()` method before stringifying. Defaults to true. */
  isNormalized: boolean;
}

class JsonExporter {
  static export (model: Database | NormalizedModel, options: JsonExporterOptions): string {
    const { isNormalized } = options;

    if (!isNormalized && model instanceof Database) {
      return JSON.stringify(model.export(), null, 2);
    }

    return JSON.stringify(model, null, 2);
  }
}

export default JsonExporter;
