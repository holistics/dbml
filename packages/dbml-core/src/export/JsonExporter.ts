import Database from '../model_structure/database';
import type { NormalizedModel } from '../../types/model_structure/model';

export interface JsonExporterOptions {
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
