import Element from './element';

class Index extends Element {
  constructor ({ columns, type, unique, pk, token, name } = {}) {
    super(token);
    this.columns = columns;
    this.name = name;
    this.type = type;
    this.unique = unique;
    this.pk = pk;
  }

  export () {
    return {
      name: this.name,
      columns: this.columns,
      type: this.type,
      unique: this.unique,
      pk: this.pk,
    };
  }
}

export default Index;
