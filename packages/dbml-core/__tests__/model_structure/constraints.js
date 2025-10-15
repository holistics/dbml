import Database from '../../src/model_structure/database';
import jsonDb from './constraints.json';

describe('@dbml/core - model_structure', () => {
  let database;

  beforeAll(() => {
    database = new Database(jsonDb);
  });

  describe('table_partial_and_table_with_constraints_schema', () => {
    describe('nested_structure', () => {
      test('table partial WithMoney has correct constraints', () => {
        const tablePartial = database.tablePartials[0];

        const tablePartialConstraint = tablePartial.constraints[0];
        expect(tablePartial.constraints.length).toEqual(1);
        expect(tablePartialConstraint.name).toEqual('not_too_much_money');
        expect(tablePartialConstraint.expression).toEqual('balance < 10000000');

        const tablePartialField = tablePartial.fields[0];
        expect(tablePartialField.constraints.length).toEqual(1);
        expect(tablePartialField.constraints[0].name).toEqual(undefined);
        expect(tablePartialField.constraints[0].expression).toEqual('balance > 0');
      });
      test('table User has correct constraints', () => {
        const table = database.schemas[0].findTable('User');

        expect(table.constraints.length).toEqual(3);

        expect(table.constraints[0].name).toEqual('not_too_much_money');
        expect(table.constraints[0].expression).toEqual('balance < 10000000');
        expect(table.constraints[0].table).toEqual(table);
        expect(table.constraints[0].injectedPartial).toEqual(database.tablePartials[0]);

        expect(table.constraints[1].name).toEqual('name_not_too_long');
        expect(table.constraints[1].expression).toEqual('LEN(name) < 256');
        expect(table.constraints[1].table).toEqual(table);

        expect(table.constraints[2].name).toEqual(undefined);
        expect(table.constraints[2].expression).toEqual("REGEXP_LIKE(email, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$')");
        expect(table.constraints[2].table).toEqual(table);

        const column0 = table.findField('name');

        expect(column0.constraints.length).toEqual(1);
        expect(column0.constraints[0].name).toEqual(undefined);
        expect(column0.constraints[0].expression).toEqual('LEN(name) > 0');
        expect(column0.constraints[0].table).toEqual(table);
        expect(column0.constraints[0].column).toEqual(column0);

        const column1 = table.findField('email');

        expect(column1.constraints.length).toEqual(0);
      });
      test('table User2 has correct constraints', () => {
        const table = database.schemas[0].findTable('User2');

        expect(table.constraints.length).toEqual(1);

        expect(table.constraints[0].name).toEqual('not_too_much_money');
        expect(table.constraints[0].expression).toEqual('balance < 10000000');
        expect(table.constraints[0].table).toEqual(table);
        expect(table.constraints[0].injectedPartial).toEqual(database.tablePartials[0]);

        const column0 = table.findField('balance');

        expect(column0.constraints.length).toEqual(0);
      });
    });
  });
});
