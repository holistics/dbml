import Element, { Token } from './element';
import Table from './table';
import Field from './field';
import TablePartial from './tablePartial';
import DbState from './dbState';

export interface RawCheck {
  token: Token;
  name: string;
  expression: string;
  table: Table;
  column?: Field | null;
  injectedPartial?: TablePartial | null;
}

class Check extends Element {
  name: string;
  expression: string;
  table: Table;
  column: Field | null;
  injectedPartial: TablePartial | null;
  dbState: DbState;

  constructor ({
    token, name, expression, table, column = null, injectedPartial = null,
  }: RawCheck) {
    super(token);
    this.name = name;
    this.expression = expression;
    this.table = table;
    this.column = column;
    this.injectedPartial = injectedPartial;
    this.dbState = this.table.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('checkId');
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds () {
    return {
      tableId: this.table.id,
      columnId: this.column?.id ?? null,
      injectedPartialId: this.injectedPartial?.id ?? null,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      expression: this.expression,
    };
  }

  normalize (model: any) {
    const id = this.id as number;
    model.checks[id] = {
      id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default Check;
