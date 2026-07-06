import Database from '../../../src/model_structure/database';
import jsonDb from './checks.json';
import { test, expect, describe } from 'vitest';

describe('@dbml/core - model_structure', () => {
  let database: Database;

  beforeAll(() => {
    database = new Database(jsonDb as any);
  });

  describe('table_partial_and_table_with_checks_schema', () => {
    describe('nested_structure', () => {
      test('table partial WithMoney has correct checks', () => {
        const tablePartial = database.tablePartials[0];

        const tablePartialConstraint = tablePartial.checks[0];
        expect(tablePartial.checks.length).toEqual(1);
        expect(tablePartialConstraint.name).toEqual('not_too_much_money');
        expect(tablePartialConstraint.expression).toEqual('balance < 10000000');

        const tablePartialField = tablePartial.fields[0];
        expect(tablePartialField.checks.length).toEqual(1);
        expect(tablePartialField.checks[0].name).toEqual(undefined);
        expect(tablePartialField.checks[0].expression).toEqual('balance > 0');
      });
      test('table User has correct checks', () => {
        const table = database.schemas[0].findTable('User');

        expect(table.checks.length).toEqual(3);

        expect(table.checks[0].name).toEqual('User.not_too_much_money');
        expect(table.checks[0].expression).toEqual('balance < 10000000');
        expect(table.checks[0].table).toEqual(table);
        expect(table.checks[0].injectedPartial).toEqual(database.tablePartials[0]);

        expect(table.checks[1].name).toEqual('name_not_too_long');
        expect(table.checks[1].expression).toEqual('LEN(name) < 256');
        expect(table.checks[1].table).toEqual(table);

        expect(table.checks[2].name).toEqual(undefined);
        expect(table.checks[2].expression).toEqual('REGEXP_LIKE(email, \'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$\')');
        expect(table.checks[2].table).toEqual(table);

        const column0 = table.findField('name');

        expect(column0.checks.length).toEqual(1);
        expect(column0.checks[0].name).toEqual(undefined);
        expect(column0.checks[0].expression).toEqual('LEN(name) > 0');
        expect(column0.checks[0].table).toEqual(table);
        expect(column0.checks[0].column).toEqual(column0);

        const column1 = table.findField('email');

        expect(column1.checks.length).toEqual(0);
      });
      test('table User2 has correct checks', () => {
        const table = database.schemas[0].findTable('User2');

        expect(table.checks.length).toEqual(1);

        expect(table.checks[0].name).toEqual('User2.not_too_much_money');
        expect(table.checks[0].expression).toEqual('balance < 10000000');
        expect(table.checks[0].table).toEqual(table);
        expect(table.checks[0].injectedPartial).toEqual(database.tablePartials[0]);

        const column0 = table.findField('balance');

        expect(column0.checks.length).toEqual(0);
      });
    });
  });
});
