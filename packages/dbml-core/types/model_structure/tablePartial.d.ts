import Element, { RawNote, Token } from './element';
import Field from './field';
import Index from './indexes';
import DbState from './dbState';
import { NormalizedDatabase } from './database';

interface RawTablePartial {
    name: string;
    note: RawNote;
    fields: Field[];
    indexes: Index[];
    token: Token;
    headerColor: string;
    dbState: DbState;
}

declare class TablePartial extends Element {
    name: string;
    note: string;
    noteToken: Token;
    fields: Field[];
    indexes: Index[];
    headerColor: string;
    dbState: DbState;
    id: number;

    constructor({ name, note, fields, indexes, token, headerColor, dbState }: RawTablePartial);
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
