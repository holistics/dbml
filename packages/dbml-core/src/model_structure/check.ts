import { NormalizedModel } from './database';
import Element, { Token } from './element';
import Field from './field';
import Table from './table';
import TablePartial from './tablePartial';
import DbState from './dbState';

interface RawCheck {
  token: Token;
  name: string;
  expression: string;
  table: Table;
  column?: Field | null;
  injectedPartial?: TablePartial | null;
}

export interface NormalizedCheck {
  id: number;
  name: string;
  expression: string;
  tableId: number;
  columnId: number | null;
  injectedPartialId: number | null;
}

export interface NormalizedCheckIdMap {
  [_id: number]: NormalizedCheck;
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

  generateId (): void {
    this.id = this.dbState.generateId('checkId');
  }

  export (): { name: string; expression: string } {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds (): { tableId: number; columnId: number | null; injectedPartialId: number | null } {
    return {
      tableId: this.table.id,
      columnId: this.column?.id ?? null,
      injectedPartialId: this.injectedPartial?.id ?? null,
    };
  }

  shallowExport (): { name: string; expression: string } {
    return {
      name: this.name,
      expression: this.expression,
    };
  }

  normalize (model: NormalizedModel): void {
    model.checks[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default Check;
