import Element from './element';

class Check extends Element {
  constructor ({
    token, name, expression, table, column = null, injectedPartial = null,
  } = {}) {
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
      columnId: this.column?.id,
      injectedPartialId: this.injectedPartial?.id,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      expression: this.expression,
    };
  }

  normalize (model) {
    model.checks[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default Check;
