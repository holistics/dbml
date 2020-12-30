import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { Token } from './element';
import Endpoint from './endpoint';
import Enum from './enum';
import Table from './table';

interface RawField {
    name: String
    type: any
    unique: boolean
    pk: boolean
    token: Token
    not_null: boolean
    note: String
    dbdefault: any
    increment: boolean
    table: Table
}

class Field extends Element {
    name: String
    type: any
    unique: boolean
    pk: boolean
    dbState: DbState
    not_null: boolean
    note: String
    dbdefault: any
    increment: boolean
    table: Table
    endpoints: Endpoint[]
    _enum: Enum

    constructor({ name, type, unique, pk, token, not_null, note, dbdefault,
        increment, table }: RawField) {
        super(token);
        if (!name) { this.error('Field must have a name'); }
        if (!type) { this.error('Field must have a type'); }
        this.name = name;
        // type : { type_name, value }
        this.type = type;
        this.unique = unique;
        this.pk = pk;
        this.not_null = not_null;
        this.note = note;
        this.dbdefault = dbdefault;
        this.increment = increment;
        this.endpoints = [];
        this.table = table;
        this.dbState = this.table.dbState;
        this.generateId();
    }

    generateId() {
        this.id = this.dbState.generateId('fieldId');
    }

    pushEndpoint(endpoint) {
        this.endpoints.push(endpoint);
    }

    export() {
        return {
            ...this.shallowExport(),
        };
    }

    exportParentIds() {
        return {
            tableId: this.table.id,
            enumId: this._enum ? this._enum.id : null,
        };
    }

    exportChildIds() {
        return {
            endpointIds: this.endpoints.map(e => e.id),
        };
    }

    shallowExport() {
        return {
            name: this.name,
            type: this.type,
            unique: this.unique,
            pk: this.pk,
            not_null: this.not_null,
            note: this.note,
            dbdefault: this.dbdefault,
            increment: this.increment,
        };
    }

    normalize(model: NormalizedDatabase) {
        model.fields = {
            ...model.fields,
            [this.id]: {
                id: this.id,
                ...this.shallowExport(),
                ...this.exportChildIds(),
                ...this.exportParentIds(),
            },
        };
    }
}

export interface NormalizedField {
    [_id: number]: {
        id: number
        name: String
        type: any
        unique: boolean
        pk: boolean
        not_null: boolean
        note: String
        dbdefault: any
        increment: boolean
    }
}

export default Field;
