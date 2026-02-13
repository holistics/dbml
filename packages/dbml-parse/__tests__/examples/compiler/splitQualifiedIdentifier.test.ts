import { splitQualifiedIdentifier } from '@/compiler/queries/utils';

describe('splitQualifiedIdentifier', () => {
  it('should split simple unquoted identifiers', () => {
    expect(splitQualifiedIdentifier('schema')).toEqual(['schema']);
    expect(splitQualifiedIdentifier('schema.table')).toEqual(['schema', 'table']);
    expect(splitQualifiedIdentifier('schema.table.column')).toEqual(['schema', 'table', 'column']);
  });

  it('should split quoted identifiers and remove quotes', () => {
    expect(splitQualifiedIdentifier('"schema"')).toEqual(['schema']);
    expect(splitQualifiedIdentifier('"schema name"')).toEqual(['schema name']);
    expect(splitQualifiedIdentifier('"schema"."table"')).toEqual(['schema', 'table']);
  });

  it('should handle quoted identifiers with dots inside', () => {
    expect(splitQualifiedIdentifier('"schema.with.dots"')).toEqual(['schema.with.dots']);
    expect(splitQualifiedIdentifier('"schema.with.dots".table')).toEqual(['schema.with.dots', 'table']);
    expect(splitQualifiedIdentifier('"schema.with.dots"."table.with.dots"')).toEqual(['schema.with.dots', 'table.with.dots']);
    expect(splitQualifiedIdentifier('"schema.with.dots"."table.with.dots".column')).toEqual(['schema.with.dots', 'table.with.dots', 'column']);
  });

  it('should handle mixed quoted and unquoted identifiers', () => {
    expect(splitQualifiedIdentifier('schema."table name"')).toEqual(['schema', 'table name']);
    expect(splitQualifiedIdentifier('"schema name".table')).toEqual(['schema name', 'table']);
    expect(splitQualifiedIdentifier('schema."table name"."column name"')).toEqual(['schema', 'table name', 'column name']);
    expect(splitQualifiedIdentifier('"schema name".table.column')).toEqual(['schema name', 'table', 'column']);
  });

  it('should handle identifiers with whitespace around dots', () => {
    expect(splitQualifiedIdentifier('schema . table')).toEqual(['schema', 'table']);
    expect(splitQualifiedIdentifier('"schema name" . table')).toEqual(['schema name', 'table']);
    expect(splitQualifiedIdentifier('schema . "table name" . column')).toEqual(['schema', 'table name', 'column']);
  });

  it('should handle leading and trailing whitespace', () => {
    expect(splitQualifiedIdentifier('  schema.table  ')).toEqual(['schema', 'table']);
    expect(splitQualifiedIdentifier('  "schema name".table  ')).toEqual(['schema name', 'table']);
  });

  it('should preserve spaces in unquoted identifiers', () => {
    expect(splitQualifiedIdentifier('app users')).toEqual(['app users']);
    expect(splitQualifiedIdentifier('my schema.my table')).toEqual(['my schema', 'my table']);
  });

  it('should handle empty string', () => {
    expect(splitQualifiedIdentifier('')).toEqual([]);
  });

  it('should handle single quoted component', () => {
    expect(splitQualifiedIdentifier('"single component"')).toEqual(['single component']);
  });

  it('should handle escaped quotes within quoted identifiers', () => {
    expect(splitQualifiedIdentifier('"schema\\"name"')).toEqual(['schema"name']);
    expect(splitQualifiedIdentifier('"schema\\"name".table')).toEqual(['schema"name', 'table']);
  });
});
