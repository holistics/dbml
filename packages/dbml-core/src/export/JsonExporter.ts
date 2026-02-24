import Database, { NormalizedModel } from 'model_structure/database';

class JsonExporter {
  static export (
    model: Database | NormalizedModel,
    flags: { isNormalized?: boolean } | boolean = {},
  ) {
    // Backwards compatibility: if a boolean is passed, treat it as the isNormalized flag
    const resolvedFlags = typeof flags === 'boolean' ? { isNormalized: flags } : flags;
    
    // isNormalized defaults to true; when false, the model is normalized before exporting
    const { isNormalized = true } = resolvedFlags;

    if (!isNormalized && model instanceof Database) {
      return JSON.stringify(model.export(), null, 2);
    }

    return JSON.stringify(model, null, 2);
  }
}

export default JsonExporter;
