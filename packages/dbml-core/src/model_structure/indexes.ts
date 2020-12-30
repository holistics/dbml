import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { Token } from './element';
import IndexColumn from './indexColumn';
import Table from './table';

interface RawIndex {
    columns: IndexColumn
    type: any
    unique: boolean
    pk: String
    name: String
    note: String
    table: Table
    token: Token
}

class Index extends Element {
    columns: IndexColumn[]
    type: any
    unique: boolean
    pk: String
    name: String
    note: String
    table: Table
    dbState: DbState

    constructor({ columns, type, unique, pk, token, name, note, table }: RawIndex) {
        super(token);
        this.name = name;
        this.type = type;
        this.unique = unique;
        this.note = note;
        this.pk = pk;
        this.columns = [];
        this.table = table;
        this.dbState = this.table.dbState;
        this.generateId();

        this.processIndexColumns(columns);
    }

    generateId() {
        this.id = this.dbState.generateId('indexId');
    }

    processIndexColumns(rawColumns) {
        rawColumns.forEach((column) => {
            this.pushIndexColumn(new IndexColumn({ ...column, index: this }));
        });
    }

    pushIndexColumn(column) {
        this.checkIndexColumn(column);
        this.columns.push(column);
    }

    checkIndexColumn(column) {
        if (this.columns.some(c => c.type === column.type && c.value === column.value)) {
            column.error(`Index column ${column.value} existed`);
        }
    }

    export() {
        return {
            ...this.shallowExport(),
            ...this.exportChild(),
        };
    }

    exportChild() {
        return {
            columns: this.columns.map(c => c.export()),
        };
    }

    exportChildIds() {
        return {
            columnIds: this.columns.map(c => c.id),
        };
    }

    exportParentIds() {
        return {
            tableId: this.table.id,
        };
    }

    shallowExport() {
        return {
            name: this.name,
            type: this.type,
            unique: this.unique,
            pk: this.pk,
            note: this.note,
        };
    }

    normalize(model: NormalizedDatabase) {
        model.indexes = {
            ...model.indexes,
            [this.id]: {
                id: this.id,
                ...this.shallowExport(),
                ...this.exportChildIds(),
                ...this.exportParentIds(),
            },
        };

        this.columns.forEach(c => c.normalize(model));
    }
}

export interface NormalizedIndex {
    [_id: number]: {
        id: number
        name: String
        type: any
        unique: boolean
        pk: String
        note: String
        columnIds: number[]
        tableId: number
    }
}

export default Index;
