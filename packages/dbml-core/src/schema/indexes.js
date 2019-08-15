import Element from './element';

class Index extends Element {
  constructor ({ columns, type, unique, token, name } = {}) {
    super(token);
    this.columns = columns;
    this.name = name;
    this.type = type;
    this.unique = unique;
  }

  export () {
    return {
      name: this.name,
      columns: this.columns,
      type: this.type,
      unique: this.unique,
    };
  }
}

export default Index;
