import Database from '../../../src/model_structure/database';
import Model from '../../../src/model_structure/model';
import jsonDb from './single_schema.json';
import { NormalizedModel } from '../../../types/model_structure/database';
import { test, expect, describe, beforeAll } from 'vitest';

describe('@dbml/core - Model', () => {
  describe('constructor', () => {
    test('creates Model from raw database input', () => {
      const model = new Model({ databases: [jsonDb] });

      expect(model.databases).toHaveLength(1);
      expect(model.databases[0]).toBeInstanceOf(Database);
    });

    test('creates Model with multiple databases', () => {
      const model = new Model({ databases: [jsonDb, jsonDb] });

      expect(model.databases).toHaveLength(2);
      model.databases.forEach((db: any) => {
        expect(db).toBeInstanceOf(Database);
      });
    });

    test('creates Model with empty database array', () => {
      const model = new Model({ databases: [] });

      expect(model.databases).toHaveLength(0);
    });

    test('all databases share the same dbState', () => {
      const model = new Model({ databases: [jsonDb, jsonDb] });

      expect(model.dbState).toBeDefined();
      expect(model.databases[0].dbState).toBe(model.dbState);
      expect(model.databases[1].dbState).toBe(model.dbState);
    });

    test('databases in the same Model have unique ids', () => {
      const model = new Model({ databases: [jsonDb, jsonDb] });

      const ids = model.databases.map((db: any) => db.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('normalize', () => {
    let databaseNormalized: NormalizedModel;
    let modelNormalized: NormalizedModel;

    beforeAll(() => {
      const database = new Database(jsonDb as any);
      databaseNormalized = database.normalize();

      const model = new Model({ databases: [jsonDb] });
      modelNormalized = model.normalize();
    });

    test('returns all expected keys', () => {
      const expectedKeys = [
        'database', 'schemas', 'endpoints', 'refs', 'fields',
        'tables', 'tableGroups', 'enums', 'enumValues',
        'indexes', 'indexColumns', 'notes', 'checks',
        'records', 'tablePartials',
      ];

      expectedKeys.forEach((key) => {
        expect(modelNormalized).toHaveProperty(key);
      });
    });

    test('produces same number of entities as Database.normalize()', () => {
      Object.keys(databaseNormalized).forEach((key) => {
        const dbCount = Object.keys((databaseNormalized as any)[key]).length;
        const modelCount = Object.keys((modelNormalized as any)[key]).length;
        expect(modelCount).toBe(dbCount);
      });
    });

    test('produces equivalent entity names as Database.normalize()', () => {
      const dbTableNames = Object.values(databaseNormalized.tables).map((t) => t.name).sort();
      const modelTableNames = Object.values(modelNormalized.tables).map((t) => t.name).sort();
      expect(modelTableNames).toEqual(dbTableNames);

      const dbEnumNames = Object.values(databaseNormalized.enums).map((e) => e.name).sort();
      const modelEnumNames = Object.values(modelNormalized.enums).map((e) => e.name).sort();
      expect(modelEnumNames).toEqual(dbEnumNames);

      const dbRefCount = Object.keys(databaseNormalized.refs).length;
      const modelRefCount = Object.keys(modelNormalized.refs).length;
      expect(modelRefCount).toBe(dbRefCount);
    });

    test('merges multiple databases', () => {
      const model = new Model({ databases: [jsonDb, jsonDb] });
      const normalized = model.normalize();

      expect(Object.keys(normalized.database)).toHaveLength(2);

      const singleModel = new Model({ databases: [jsonDb] });
      const singleNormalized = singleModel.normalize();

      expect(Object.keys(normalized.schemas).length).toBe(
        Object.keys(singleNormalized.schemas).length * 2,
      );
      expect(Object.keys(normalized.tables).length).toBe(
        Object.keys(singleNormalized.tables).length * 2,
      );
      expect(Object.keys(normalized.fields).length).toBe(
        Object.keys(singleNormalized.fields).length * 2,
      );
    });

    test('merged databases have no id collisions', () => {
      const model = new Model({ databases: [jsonDb, jsonDb] });
      const normalized = model.normalize();

      // All table ids should be unique
      const tableIds = Object.keys(normalized.tables);
      expect(new Set(tableIds).size).toBe(tableIds.length);

      // All field ids should be unique
      const fieldIds = Object.keys(normalized.fields);
      expect(new Set(fieldIds).size).toBe(fieldIds.length);
    });

    test('empty model normalizes to empty collections', () => {
      const model = new Model({ databases: [] });
      const normalized = model.normalize();

      Object.values(normalized).forEach((collection) => {
        expect(Object.keys(collection)).toHaveLength(0);
      });
    });
  });
});
