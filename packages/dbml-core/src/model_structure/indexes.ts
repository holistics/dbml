import Element, { RawNote, Token } from './element';
import IndexColumn from './indexColumn';
import Table from './table';
import TablePartial from './tablePartial';
import DbState from './dbState';
import { NormalizedModel } from './database';

interface RawIndex {
  columns: any;
  type: any;
  unique: boolean;
  pk: string;
  name: string;
  note: RawNote;
  table: Table;
  token: Token;
  injectedPartial?: TablePartial | null;
}

export interface NormalizedIndex {
  id: number;
  name: string | null;
  type: any;
  unique: boolean;
  pk: string;
  note: string | null;
  columnIds: number[];
  tableId: number;
  injectedPartialId?: number;
}

export interface NormalizedIndexIdMap {
  [_id: number]: NormalizedIndex;
}

class Index extends Element {
  columns: IndexColumn[];
  type: any;
  unique: boolean;
  pk: string;
  name: string;
  note: string;
  noteToken: Token;
  table: Table;
  dbState: DbState;
  injectedPartial: TablePartial;

  constructor ({
    columns, type, unique, pk, token, name, note, table = {} as Table, injectedPartial = null,
  }: RawIndex) {
    super(token);
    this.name = name;
    this.type = type;
    this.unique = unique;
    this.note = (note ? note.value : null) as string;
    this.noteToken = (note ? note.token : null) as Token;
    this.pk = pk;
    this.columns = [];
    this.table = table;
    this.injectedPartial = injectedPartial as TablePartial;
    this.dbState = this.table.dbState;
    this.generateId();

    this.processIndexColumns(columns);
  }

  generateId (): void {
    this.id = this.dbState.generateId('indexId');
  }

  processIndexColumns (rawColumns: any): void {
    rawColumns.forEach((column: any) => {
      this.pushIndexColumn(new IndexColumn({ ...column, index: this }));
    });
  }

  pushIndexColumn (column: any): void {
    this.checkIndexColumn(column);
    this.columns.push(column);
  }

  checkIndexColumn (column: any): void {
    if (this.columns.some((c) => c.type === column.type && c.value === column.value)) {
      column.error(`Index column ${column.value} existed`);
    }
  }

  export (): ReturnType<Index['shallowExport']> & ReturnType<Index['exportChild']> {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  exportChild (): { columns: { type: any; value: any }[] } {
    return {
      columns: this.columns.map((c) => c.export()),
    };
  }

  exportChildIds (): { columnIds: number[] } {
    return {
      columnIds: this.columns.map((c) => c.id),
    };
  }

  exportParentIds (): { tableId: number } {
    return {
      tableId: this.table.id,
    };
  }

  shallowExport (): {
    name: string;
    type: any;
    unique: boolean;
    pk: string;
    note: string;
    injectedPartialId: number | undefined;
  } {
    return {
      name: this.name,
      type: this.type,
      unique: this.unique,
      pk: this.pk,
      note: this.note,
      injectedPartialId: this.injectedPartial?.id,
    };
  }

  normalize (model: NormalizedModel): void {
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
