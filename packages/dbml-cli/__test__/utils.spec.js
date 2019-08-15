import fs from 'fs';
import { generateFilePathList, validate } from '../src/cli/utils';
import {
  getInputFileExtension as getInputFileExtensionImport,
  getOutputFileExtension as getOutputFileExtensionImport,
} from '../src/cli/import';

jest.mock('fs');

describe('Utils', () => {
  describe('#generateFilePathList-import', () => {
    beforeEach(() => {
      fs.__clearMockFiles();
    });

    test('input path: directory, output path: directory', async () => {
      const MOCK_FILE_INFO = {
        './postgres/users.sql': '',
        './postgres/orders.sql': '',
        './postgres/cities.sql': '',
      };

      fs.__setMockFiles(MOCK_FILE_INFO);
      fs.stat = function (path, callback) {
        callback(null, { isDirectory: () => true });
      };

      const inputFileExtension = getInputFileExtensionImport('postgres');
      const outputFileExtension = getOutputFileExtensionImport();

      const filePathList = await generateFilePathList('./postgres', './dbml', inputFileExtension, outputFileExtension);
      expect(filePathList.sort()).toEqual([
        {
          inputFile: './postgres/users.sql',
          outputFile: './dbml/users.dbml',
        },
        {
          inputFile: './postgres/orders.sql',
          outputFile: './dbml/orders.dbml',
        },
        {
          inputFile: './postgres/cities.sql',
          outputFile: './dbml/cities.dbml',
        },
      ].sort());
    });

    test('input path: directory, output path: file (created) - expected error', async () => {
      const MOCK_FILE_INFO = {
        './postgres/users.sql': '',
        './postgres/orders.sql': '',
        './postgres/cities.sql': '',
      };

      fs.__setMockFiles(MOCK_FILE_INFO);
      fs.stat = function (path, callback) {
        if (path === './dbml/schema.dbml') return callback(null, { isDirectory: () => false });
        return callback(null, { isDirectory: () => true });
      };

      const inputFileExtension = getInputFileExtensionImport('postgres');
      const outputFileExtension = getOutputFileExtensionImport();
      let mess = false;
      try {
        await generateFilePathList('./postgres', './dbml/schema.dbml', inputFileExtension, outputFileExtension);
      } catch ({ message }) {
        mess = message;
      }

      expect(mess).toBe('Expect an output path is a directory');
    });

    test('input path: file, output path: file (not created)', async () => {
      fs.stat = function (path, callback) {
        if (path === './schema/users.json') {
          callback(null, { isDirectory: () => false });
        } else {
          callback(new Error());
        }
      };

      const inputFileExtension = getInputFileExtensionImport('json');
      const outputFileExtension = getOutputFileExtensionImport();
      const filePathList = await generateFilePathList('./schema/users.json', './users.dbml',
        inputFileExtension, outputFileExtension);
      expect(filePathList.sort()).toEqual([
        {
          inputFile: './schema/users.json',
          outputFile: './users.dbml',
        },
      ].sort());
    });

    test('input path: file, output path: file (override)', async () => {
      fs.stat = function (path, callback) {
        callback(null, { isDirectory: () => false });
      };

      const inputFileExtension = getInputFileExtensionImport('json');
      const outputFileExtension = getOutputFileExtensionImport();
      const filePathList = await generateFilePathList('./users.json', './dbml/users.dbml',
        inputFileExtension, outputFileExtension);
      expect(filePathList.sort()).toEqual([
        {
          inputFile: './users.json',
          outputFile: './dbml/users.dbml',
        },
      ].sort());
    });

    test('input path: file, output path: directory', async () => {
      const inputPath = './schema.sql';
      fs.stat = function (path, callback) {
        callback(null, { isDirectory: () => path !== inputPath });
      };

      const inputFileExtension = getInputFileExtensionImport('mysql');
      const outputFileExtension = getOutputFileExtensionImport();
      const filePathList = await generateFilePathList('./schema.sql', './dbml', inputFileExtension, outputFileExtension);
      expect(filePathList.sort()).toEqual([
        {
          inputFile: './schema.sql',
          outputFile: './dbml/schema.dbml',
        },
      ].sort());
    });
  });

  describe('#validate-options', () => {
    const flagObject = {
      mysql: undefined,
      postgres: undefined,
      json: undefined,
    };
    afterEach(() => {
      flagObject.mysql = undefined;
      flagObject.postgres = undefined;
      flagObject.json = undefined;
    });
    test('no option', () => {
      expect(validate(flagObject)).toEqual('json');
    });
    test('one option --mysql', () => {
      flagObject.mysql = true;
      expect(validate(flagObject)).toEqual('mysql');
    });
    test('one option --postgres', () => {
      flagObject.postgres = true;
      expect(validate(flagObject)).toEqual('postgres');
    });
    test('one option --json', () => {
      flagObject.json = true;
      expect(validate(flagObject)).toEqual('json');
    });
    test('more than one option', () => {
      flagObject.mysql = true;
      flagObject.postgres = true;
      flagObject.json = true;
      let mess = '';
      try {
        validate(flagObject);
      } catch (error) {
        mess = error.message;
      }
      expect(mess).toEqual('Too many options');
    });
  });
});
