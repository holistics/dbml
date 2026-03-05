import Element from './element';

class Function extends Element {
  constructor ({
    name, schemaName, returns, args, body, language, behavior, security, token, database = {},
  } = {}) {
    super(token);
    this.name = name;
    this.schemaName = schemaName;
    this.returns = returns;
    this.args = args;
    this.body = body;
    this.language = language;
    this.behavior = behavior;
    this.security = security;
    this.database = database;
    this.dbState = this.database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('functionId');
  }

  shallowExport () {
    return {
      name: this.name,
      schemaName: this.schemaName,
      returns: this.returns,
      args: this.args,
      body: this.body,
      language: this.language,
      behavior: this.behavior,
      security: this.security,
    };
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  normalize (model) {
    model.functions[this.id] = {
      id: this.id,
      ...this.shallowExport(),
    };
  }
}

export default Function;
