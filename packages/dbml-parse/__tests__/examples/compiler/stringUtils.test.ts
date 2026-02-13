import { unescapeString, escapeString } from '@/compiler/queries/utils';

describe('unescapeString', () => {
  it('should handle escaped quotes', () => {
    expect(unescapeString('table\\"name')).toBe('table"name');
    expect(unescapeString("table\\'name")).toBe("table'name");
  });

  it('should handle common escape sequences', () => {
    expect(unescapeString('line1\\nline2')).toBe('line1\nline2');
    expect(unescapeString('tab\\there')).toBe('tab\there');
    expect(unescapeString('carriage\\rreturn')).toBe('carriage\rreturn');
    expect(unescapeString('back\\\\slash')).toBe('back\\slash');
  });

  it('should handle unicode escape sequences', () => {
    expect(unescapeString('\\u0041')).toBe('A');
    expect(unescapeString('\\u0041BC')).toBe('ABC');
    expect(unescapeString('Hello\\u0020World')).toBe('Hello World');
    expect(unescapeString('\\u03B1\\u03B2\\u03B3')).toBe('αβγ');
  });

  it('should handle invalid unicode sequences as regular escapes', () => {
    expect(unescapeString('\\u')).toBe('u');
    expect(unescapeString('\\u1')).toBe('u1');
    expect(unescapeString('\\u12')).toBe('u12');
    expect(unescapeString('\\u123')).toBe('u123');
    expect(unescapeString('\\uGGGG')).toBe('uGGGG');
  });

  it('should handle arbitrary escape sequences', () => {
    expect(unescapeString('\\x')).toBe('x');
    expect(unescapeString('\\a')).toBe('a');
    expect(unescapeString('\\z')).toBe('z');
  });

  it('should handle mixed content', () => {
    expect(unescapeString('table\\"name\\nwith\\ttab')).toBe('table"name\nwith\ttab');
    expect(unescapeString('\\u0041\\nB\\tC')).toBe('A\nB\tC');
  });

  it('should handle empty string', () => {
    expect(unescapeString('')).toBe('');
  });

  it('should handle string without escapes', () => {
    expect(unescapeString('plain text')).toBe('plain text');
  });
});

describe('escapeString', () => {
  it('should escape quotes', () => {
    expect(escapeString('table"name')).toBe('table\\"name');
    expect(escapeString("table'name")).toBe("table\\'name");
  });

  it('should escape special characters', () => {
    expect(escapeString('line1\nline2')).toBe('line1\\nline2');
    expect(escapeString('tab\there')).toBe('tab\\there');
    expect(escapeString('carriage\rreturn')).toBe('carriage\\rreturn');
    expect(escapeString('back\\slash')).toBe('back\\\\slash');
  });

  it('should handle mixed content', () => {
    expect(escapeString('table"name\nwith\ttab')).toBe('table\\"name\\nwith\\ttab');
  });

  it('should handle empty string', () => {
    expect(escapeString('')).toBe('');
  });

  it('should handle string without special chars', () => {
    expect(escapeString('plain text')).toBe('plain text');
  });

  it('should roundtrip with unescapeString', () => {
    const original = 'table"name\nwith\ttab';
    expect(unescapeString(escapeString(original))).toBe(original);
  });
});
