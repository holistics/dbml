import { isValidIdentifier, addDoubleQuoteIfNeeded } from '@/compiler/index';

describe('isValidIdentifier', () => {
  test('should return true for simple alphanumeric identifier', () => {
    expect(isValidIdentifier('users')).toBe(true);
    expect(isValidIdentifier('User')).toBe(true);
    expect(isValidIdentifier('TABLE123')).toBe(true);
  });

  test('should return true for identifier with underscores', () => {
    expect(isValidIdentifier('user_name')).toBe(true);
    expect(isValidIdentifier('_private')).toBe(true);
    expect(isValidIdentifier('__internal__')).toBe(true);
    expect(isValidIdentifier('my_table_123')).toBe(true);
  });

  test('should return false for identifier starting with digit', () => {
    expect(isValidIdentifier('123users')).toBe(false);
    expect(isValidIdentifier('1table')).toBe(false);
    expect(isValidIdentifier('9_column')).toBe(false);
  });

  test('should return false for identifier with spaces', () => {
    expect(isValidIdentifier('user name')).toBe(false);
    expect(isValidIdentifier('my table')).toBe(false);
    expect(isValidIdentifier(' users')).toBe(false);
    expect(isValidIdentifier('users ')).toBe(false);
  });

  test('should return false for identifier with special characters', () => {
    expect(isValidIdentifier('user-name')).toBe(false);
    expect(isValidIdentifier('user.name')).toBe(false);
    expect(isValidIdentifier('user@domain')).toBe(false);
    expect(isValidIdentifier('user$var')).toBe(false);
    expect(isValidIdentifier('user#tag')).toBe(false);
  });

  test('should return false for empty string', () => {
    expect(isValidIdentifier('')).toBe(false);
  });

  test('should return false for identifier with unicode characters that do not fall into the whitespace category', () => {
    expect(isValidIdentifier('user_名前')).toBe(true);
    expect(isValidIdentifier('таблица')).toBe(true);
    expect(isValidIdentifier('用户')).toBe(true);
  });
});

describe('addDoubleQuoteIfNeeded', () => {
  test('should not add quotes to valid identifiers', () => {
    expect(addDoubleQuoteIfNeeded('users')).toBe('users');
    expect(addDoubleQuoteIfNeeded('user_name')).toBe('user_name');
    expect(addDoubleQuoteIfNeeded('_private')).toBe('_private');
    expect(addDoubleQuoteIfNeeded('TABLE123')).toBe('TABLE123');
  });

  test('should add quotes to identifier with spaces', () => {
    expect(addDoubleQuoteIfNeeded('user name')).toBe('"user name"');
    expect(addDoubleQuoteIfNeeded('my table')).toBe('"my table"');
    expect(addDoubleQuoteIfNeeded(' users')).toBe('" users"');
  });

  test('should add quotes to identifier starting with digit', () => {
    expect(addDoubleQuoteIfNeeded('123users')).toBe('"123users"');
    expect(addDoubleQuoteIfNeeded('1table')).toBe('"1table"');
  });

  test('should add quotes to identifier with special characters', () => {
    expect(addDoubleQuoteIfNeeded('user-name')).toBe('"user-name"');
    expect(addDoubleQuoteIfNeeded('user.name')).toBe('"user.name"');
    expect(addDoubleQuoteIfNeeded('user@domain')).toBe('"user@domain"');
  });

  test('should add quotes to empty string', () => {
    expect(addDoubleQuoteIfNeeded('')).toBe('""');
  });

  test('should not add quotes to identifier with unicode characters that do not fall into the whitespace category', () => {
    expect(addDoubleQuoteIfNeeded('user_名前')).toBe('user_名前');
    expect(addDoubleQuoteIfNeeded('таблица')).toBe('таблица');
  });

  test('should handle identifiers that already need quotes for other reasons', () => {
    expect(addDoubleQuoteIfNeeded('table-123')).toBe('"table-123"');
    expect(addDoubleQuoteIfNeeded('my.schema.table')).toBe('"my.schema.table"');
  });
});
