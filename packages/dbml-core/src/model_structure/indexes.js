import Element from './element';
import IndexColumn from './indexColumn';

class Index extends Element {
  constructor ({ columns, type, unique, pk, token, name, table = {} } = {}) {
    super(token);
    this.name = name;
    this.type = type;
    this.unique = unique;
    this.pk = pk;
    this.columns = [];
    this.table = table;

    this.processIndexColumns(columns);
  }

  processIndexColumns (rawColumns) {
    rawColumns.forEach((column) => {
      this.pushIndexColumn(new IndexColumn({ ...column, index: this }));
    });
  }

  pushIndexColumn (column) {
    this.checkIndexColumn(column);
    this.columns.push(column);
  }

  checkIndexColumn (column) {
    if (this.columns.some(c => c.type === column.type && c.value === column.value)) {
      column.error(`Index column ${column.value} existed`);
    }
  }

  export () {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  exportChild () {
    return {
      columns: this.columns.map(c => c.export()),
    };
  }

  exportChildIds () {
    return {
      column_ids: this.columns.map(c => c.id),
    };
  }

  exportParentIds () {
    return {
      table_id: this.table.id,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      type: this.type,
      unique: this.unique,
      pk: this.pk,
    };
  }

  normalize (model) {
    model.indexes = {
      ...model.indexes,
      [this.id]: {
        ...this.shallowExport(),
        ...this.exportChildIds(),
        ...this.exportParentIds(),
      },
    };

    this.columns.forEach(c => c.normalize(model));
  }
}

export default Index;
