import { NormalizedModel } from './database';
import DbState from './dbState';
import Element, { Token, RawNote } from './element';
import Endpoint from './endpoint';
import Enum from './enum';
import Table from './table';
import TablePartial from './tablePartial';
import Check, { RawCheck } from './check';
export interface InlineRef {
    schemaName: string | null;
    tableName: string;
    fieldNames: string[];
    relation: '>' | '<' | '-' | '<>';
    token: Token;
}

export interface ColumnType {
    schemaName: string | null;
    type_name: string;
    args: string | null;
}

export interface RawField {
    name: string;
    type: ColumnType;
    token: Token;
    inline_refs: InlineRef[];
    checks: RawCheck[];
    pk?: boolean;
    dbdefault?: {
        type: 'number' | 'string' | 'boolean' | 'expression';
        value: number | string;
    };
    increment?: boolean;
    unique?: boolean;
    not_null?: boolean;
    note?: RawNote;
}
declare class Field extends Element {
    name: string;
    type: any;
    unique: boolean;
    pk: boolean;
    dbState: DbState;
    not_null: boolean;
    note: string;
    noteToken: Token;
    dbdefault: any;
    increment: boolean;
    checks: Check[];
    table: Table;
    endpoints: Endpoint[];
    _enum: Enum;
    injectedPartial?: TablePartial;
    injectedToken: Token;
    constructor({ name, type, unique, pk, token, not_null, note, dbdefault, increment, checks, inline_refs, table }: RawField & {
        table: Table;
    });
    generateId(): void;
    pushEndpoint(endpoint: any): void;
    processChecks(checks: any[]): void;
    export(): {
        name: string;
        type: any;
        unique: boolean;
        pk: boolean;
        not_null: boolean;
        note: string;
        dbdefault: any;
        increment: boolean;
        injectedPartialId?: number;
    };
    exportParentIds(): {
        tableId: number;
        enumId: number;
    };
    exportChildIds(): {
        endpointIds: number[];
    };
    shallowExport(): {
        name: string;
        type: any;
        unique: boolean;
        pk: boolean;
        not_null: boolean;
        note: string;
        dbdefault: any;
        increment: boolean;
        injectedPartialId?: number;
        checkIds: number[];
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedField {
    id: number;
    name: string;
    type: {
        schemaName: string | null;
        type_name: string;
    };
    unique: boolean;
    pk: boolean;
    not_null: boolean;
    note: string | null;
    dbdefault: unknown;
    increment: boolean;
    endpointIds: number[];
    tableId: number;
    enumId: number | null;
    injectedPartialId: number | null;
    checkIds: number[];
}

export interface NormalizedFieldIdMap {
    [_id: number]: NormalizedField;
}

export default Field;
