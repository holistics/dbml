import { Parser } from '../../../src';

describe('@dbml/core - table settings', () => {
  it('Compatible with no table settings', () => {
    const jsonObject = Parser.parseDBMLToJSON(`
      table user {
        id int [pk]
    }
      `, 'dbml');
    const table = jsonObject.tables[0];
    expect(table.note).toBeUndefined();
    expect(table.headerColor).toBeUndefined();
  });
  it('Have note setting', () => {
    const jsonObject = Parser.parseDBMLToJSON(`
      table user [note: 'user email must be unique'] {
        id int [pk]
        email string [unique]
    }
      `, 'dbml');
    const table = jsonObject.tables[0];
    expect(table.note).toBe('user email must be unique');
  });
  it('Have headerColor setting', () => {
    const jsonObject = Parser.parseDBMLToJSON(`
      table user [headerColor: #89f1f3] {
        id int [pk]
        email string [unique]
    }
      `, 'dbml');
    const table = jsonObject.tables[0];
    expect(table.headerColor).toBe('#89F1F3');
  });
  it('Have headerColor and note settings', () => {
    const jsonObject = Parser.parseDBMLToJSON(`
      table user [headerColor: #89f1f3, note: 'user email must be unique'] {
        id int [pk]
        email string [unique]
    }
      `, 'dbml');
    const table = jsonObject.tables[0];
    expect(table.note).toBe('user email must be unique');
    expect(table.headerColor).toBe('#89F1F3');
  });
  it('Have headerColor and note settings on multiple lines', () => {
    const jsonObject = Parser.parseDBMLToJSON(`
      table user [
        headerColor: #89f1f3,
        note: 'user email must be unique'] {
        id int [pk]
        email string [unique]
    }
      `, 'dbml');
    const table = jsonObject.tables[0];
    expect(table.note).toBe('user email must be unique');
    expect(table.headerColor).toBe('#89F1F3');
  });
  it('Throw error with inconsistent syntax', () => {
    expect(() => {
      const jsonObject = Parser.parseDBMLToJSON(`
        table user
        [
        headerColor: #89f1f3,
        note: 'user email must be unique'] {
        id int [pk]
        email string [unique]
      }
        `, 'dbml');
      const table = jsonObject.tables[0];
      expect(table.note).toBe('user email must be unique');
      expect(table.headerColor).toBe('#89F1F3');
    }).toThrow();
  });
});
