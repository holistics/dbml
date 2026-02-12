import Element from './element';

class Policy extends Element {
  constructor ({
    name, schemaName, tableName, behavior, command, roles, using, check, token, database = {},
  } = {}) {
    super(token);
    this.name = name;
    this.schemaName = schemaName;
    this.tableName = tableName;
    this.behavior = behavior;
    this.command = command;
    this.roles = roles;
    this.using = using;
    this.check = check;
    this.database = database;
    this.dbState = this.database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('policyId');
  }

  shallowExport () {
    return {
      name: this.name,
      schemaName: this.schemaName,
      tableName: this.tableName,
      behavior: this.behavior,
      command: this.command,
      roles: this.roles,
      using: this.using,
      check: this.check,
    };
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  normalize (model) {
    model.policies[this.id] = {
      id: this.id,
      ...this.shallowExport(),
    };
  }
}

export default Policy;
