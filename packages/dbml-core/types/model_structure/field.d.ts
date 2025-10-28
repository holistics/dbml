import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { Token, RawNote } from './element';
import Endpoint from './endpoint';
import Enum from './enum';
import Table from './table';
import TablePartial from './tablePartial';
import Check from './check';
interface RawField {
    name: string;
    type: any;
    unique: boolean;
    pk: boolean;
    token: Token;
    not_null: boolean;
    note: RawNote;
    dbdefault: any;
    increment: boolean;
    checks?: any[];
    table: Table;
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
    constructor({ name, type, unique, pk, token, not_null, note, dbdefault, increment, checks, table }: RawField);
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
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedField {
    [_id: number]: {
        id: number;
        name: string;
        type: any;
        unique: boolean;
        pk: boolean;
        not_null: boolean;
        note: string;
        dbdefault: any;
        increment: boolean;
        tableId: number;
        endpointIds: number[];
        enumId: number;
        injectedPartialId?: number;
        checkIds: number[];
    };
}
export default Field;
