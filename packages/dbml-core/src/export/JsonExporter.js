class JsonExporter {
  static export (model, isNormalized) {
    if (!isNormalized) {
      return JSON.stringify(model.export(), null, 2);
    }

    return JSON.stringify(model, null, 2);
  }
}

export default JsonExporter;
