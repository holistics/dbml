import Element, { Token, RawNote } from './element';
import IndexColumn from './indexColumn';
import Table from './table';
import TablePartial from './tablePartial';
import DbState from './dbState';

export interface RawIndex {
  columns: any[];
  type: any;
  unique: boolean;
  pk: string;
  name: string;
  note: RawNote;
  table: Table;
  token: Token;
  injectedPartial?: TablePartial | null;
}

class Index extends Element {
  name: string;
  type: any;
  unique: boolean;
  note: string | null;
  noteToken: Token | null;
  pk: string;
  columns: IndexColumn[];
  table: Table;
  injectedPartial: TablePartial | null;
  dbState: DbState;

  constructor ({
    columns, type, unique, pk, token, name, note, table = {} as Table, injectedPartial = null,
  }: RawIndex) {
    super(token);
    this.name = name;
    this.type = type;
    this.unique = unique;
    this.note = note ? (note as RawNote).value : null;
    this.noteToken = note ? (note as RawNote).token : null;
    this.pk = pk;
    this.columns = [];
    this.table = table;
    this.injectedPartial = injectedPartial;
    this.dbState = this.table.dbState;
    this.generateId();

    this.processIndexColumns(columns);
  }

  generateId () {
    this.id = this.dbState.generateId('indexId');
  }

  processIndexColumns (rawColumns: any[]) {
    rawColumns.forEach((column) => {
      this.pushIndexColumn(new IndexColumn({ ...column, index: this }));
    });
  }

  pushIndexColumn (column: IndexColumn) {
    this.checkIndexColumn(column);
    this.columns.push(column);
  }

  checkIndexColumn (column: IndexColumn) {
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

  normalize (model: any) {
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
