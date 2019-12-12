class JsonExporter {
  static export (database) {
    return JSON.stringify(database.export(), null, 2);
  }
}

export default JsonExporter;
