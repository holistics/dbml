import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type Table from '../../types/model_structure/table';
import type Field from '../../types/model_structure/field';
import type TablePartial from '../../types/model_structure/tablePartial';
import type DbState from '../../types/model_structure/dbState';
import type { NormalizedModel } from '../../types/model_structure/database';

interface RawCheck {
  token: Token;
  name: string;
  expression: string;
  table: Table;
  column?: Field | null;
  injectedPartial?: TablePartial | null;
}

class Check extends Element {
  declare id: number;
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

  normalize (model: NormalizedModel) {
    model.checks[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default Check;
