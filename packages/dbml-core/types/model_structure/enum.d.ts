import { NormalizedModel } from './database';
import DbState from './dbState';
import Element, { Token, RawNote } from './element';
import EnumValue, { RawEnumValue } from './enumValue';
import Field from './field';
import Schema from './schema';
export interface RawEnum {
    name: string;
    schemaName: string | null;
    token: Token;
    values: RawEnumValue[];
    note?: RawNote;
    noteToken?: Token;
}
declare class Enum extends Element {
    name: string;
    token: Token;
    values: EnumValue[];
    note: string;
    noteToken: Token;
    schema: Schema;
    fields: Field[];
    dbState: DbState;
    id: number;
    constructor({ name, token, values, note, schema, noteToken }: RawEnum & {
        schema: Schema;
    });
    generateId(): void;
    processValues(rawValues: any): void;
    pushValue(value: any): void;
    checkValue(value: any): void;
    pushField(field: any): void;
    checkField(field: any): void;
    export(): {
        values: {
            name: string;
            note: string;
        }[];
        name: string;
        note: string;
    };
    exportChild(): {
        values: {
            name: string;
            note: string;
        }[];
    };
    exportChildIds(): {
        valueIds: number[];
        fieldIds: number[];
    };
    exportParentIds(): {
        schemaId: number;
    };
    shallowExport(): {
        name: string;
        note: string;
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedEnum {
    id: number;
    name: string;
    note: string | null;
    valueIds: number[];
    fieldIds: number[];
    schemaId: number;
}

export interface NormalizedEnumIdMap {
    [_id: number]: NormalizedEnum;
}

export default Enum;
