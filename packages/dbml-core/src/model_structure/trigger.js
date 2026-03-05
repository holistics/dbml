import Element from './element';

class Trigger extends Element {
  constructor ({
    name, schemaName, tableName, when, event, updateOf, forEach, condition,
    functionName, constraint, deferrable, timing, token, database = {},
  } = {}) {
    super(token);
    this.name = name;
    this.schemaName = schemaName;
    this.tableName = tableName;
    this.when = when;
    this.event = event;
    this.updateOf = updateOf;
    this.forEach = forEach;
    this.condition = condition;
    this.functionName = functionName;
    this.constraint = constraint;
    this.deferrable = deferrable;
    this.timing = timing;
    this.database = database;
    this.dbState = this.database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('triggerId');
  }

  shallowExport () {
    return {
      name: this.name,
      schemaName: this.schemaName,
      tableName: this.tableName,
      when: this.when,
      event: this.event,
      updateOf: this.updateOf,
      forEach: this.forEach,
      condition: this.condition,
      functionName: this.functionName,
      constraint: this.constraint,
      deferrable: this.deferrable,
      timing: this.timing,
    };
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  normalize (model) {
    model.triggers[this.id] = {
      id: this.id,
      ...this.shallowExport(),
    };
  }
}

export default Trigger;
