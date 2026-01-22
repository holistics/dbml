import Element, { RawNote, Token } from './element';
import Field, { RawField } from './field';
import Index, { RawIndex } from './indexes';
import Check, { RawCheck } from './check';
import DbState from './dbState';
import { NormalizedDatabase } from './database';

export interface RawTablePartial {
    name: string;
    fields: RawField[];
    token: Token;
    indexes: RawIndex[];
    headerColor?: string;
    checks: RawCheck[];
    note?: RawNote;
}

declare class TablePartial extends Element {
    name: string;
    note: string;
    noteToken: Token;
    fields: Field[];
    indexes: Index[];
    checks: Check[];
    headerColor: string;
    dbState: DbState;
    id: number;

    constructor({ name, note, fields, indexes, checks, token, headerColor, dbState }: RawTablePartial & { dbState: DbState });
    generateId(): void;
    export(): {
        name: string;
        note: string;
        headerColor: string;
        fields: {
            name: string;
            type: any;
            unique: boolean;
            pk: boolean;
            not_null: boolean;
            note: string;
            dbdefault: any;
            increment: boolean;
            injectedPartialId: number | undefined,
        }[];
        indexes: {
            columns: {
                type: any;
                value: any;
            }[];
            name: string;
            type: any;
            unique: boolean;
            pk: string;
            note: string;
        }[];
    };
    shallowExport(): {
        name: string;
        note: string;
        headerColor: string;
        fields: {
            name: string;
            type: any;
            unique: boolean;
            pk: boolean;
            not_null: boolean;
            note: string;
            dbdefault: any;
            increment: boolean;
            injectedPartialId: number | undefined,
        }[];
        indexes: {
            columns: {
                type: any;
                value: any;
            }[];
            name: string;
            type: any;
            unique: boolean;
            pk: string;
            note: string;
        }[];
    };
    normalize(model: NormalizedDatabase): void;
}

export interface NormalizedTablePartial {
    [id: number]: {
        id: number;
        name: string;
        note: string;
        headerColor: string;
        fieldIds: number[];
        indexIds: number[];
    };
}

export default TablePartial;
