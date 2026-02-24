import { generateDatabase } from '../parse/databaseGenerator';
import Parser, { ParseFormat } from '../parse/Parser';
import ModelExporter from '../export/ModelExporter';

function _import (str: string, format: ParseFormat): string {
  const database = (new Parser()).parse(str, format);
  const dbml = ModelExporter.export(database.normalize(), 'dbml');

  return dbml;
}

function generateDbml (schemaJson: object): string {
  const database = generateDatabase(schemaJson);
  const dbml = ModelExporter.export(database.normalize(), 'dbml');

  return dbml;
}

export default {
  import: _import,
  generateDbml,
};
