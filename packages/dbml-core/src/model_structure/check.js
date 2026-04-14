/// <reference path="../../types/model_structure/check.d.ts" />
// @ts-check
import Element from './element';

/**
  * @type  Check
  */
class Check extends Element {
  constructor ({
    token, name, expression, table, column = null, injectedPartial = null,
  } = {}) {
    super(token);
    this.name = name;
    /** @type {string} */
    this.expression = expression;
    /** @type {import('../../types/model_structure/table').default} */
    this.table = table;
    /** @type {import('../../types/model_structure/field').default} */
    this.column = column;
    /** @type {import('../../types/model_structure/tablePartial').default} */
    this.injectedPartial = injectedPartial;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = this.table.dbState;
    this.generateId();
  }

  generateId () {
    /** @type {number} */
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

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.checks[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default Check;
