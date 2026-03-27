import Element from './element';
import IndexColumn from './indexColumn';

class Index extends Element {
  /**
   * @param {import('../../types/model_structure/indexes').RawIndex} param0
   */
  constructor ({
    columns, type, unique, pk, token, name, note, table = {}, injectedPartial = null,
  } = {}) {
    super(token);
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.type = type;
    /** @type {boolean} */
    this.unique = unique;
    /** @type {string} */
    this.note = note ? note.value : null;
    /** @type {import('../../types/model_structure/element').Token} */
    this.noteToken = note ? note.token : null;
    /** @type {boolean} */
    this.pk = pk;
    /** @type {import('../../types/model_structure/indexColumn').default[]} */
    this.columns = [];
    /** @type {import('../../types/model_structure/table').default} */
    this.table = table;
    /** @type {import('../../types/model_structure/tablePartial').default} */
    this.injectedPartial = injectedPartial;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = this.table.dbState;
    this.generateId();

    this.processIndexColumns(columns);
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('indexId');
  }

  /**
   * @param {any[]} rawColumns
   */
  processIndexColumns (rawColumns) {
    rawColumns.forEach((column) => {
      this.pushIndexColumn(new IndexColumn({ ...column, index: this }));
    });
  }

  /**
   * @param {import('../../types/model_structure/indexColumn').default} column
   */
  pushIndexColumn (column) {
    this.checkIndexColumn(column);
    this.columns.push(column);
  }

  /**
   * @param {import('../../types/model_structure/indexColumn').default} column
   */
  checkIndexColumn (column) {
    if (this.columns.some((c) => c.type === column.type && c.value === column.value)) {
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
      columns: this.columns.map((c) => c.export()),
    };
  }

  exportChildIds () {
    return {
      columnIds: this.columns.map((c) => c.id),
    };
  }

  exportParentIds () {
    return {
      tableId: this.table.id,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      type: this.type,
      unique: this.unique,
      pk: this.pk,
      note: this.note,
      injectedPartialId: this.injectedPartial?.id,
    };
  }

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.indexes[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.columns.forEach((c) => c.normalize(model));
  }
}

export default Index;
