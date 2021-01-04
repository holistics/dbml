import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { Token } from './element';
import EnumValue from './enumValue';
import Field from './field';
import Schema from './schema';
interface RawEnum {
    name: string;
    token: Token;
    values: EnumValue[];
    note: string;
    schema: Schema;
}
declare class Enum extends Element {
    name: string;
    token: Token;
    values: EnumValue[];
    note: string;
    schema: Schema;
    fields: Field[];
    dbState: DbState;
    id: number;
    constructor({ name, token, values, note, schema }: RawEnum);
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
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedEnum {
    [_id: number]: {
        id: number;
        name: string;
        note: string;
        valueIds: number[];
        fieldIds: number[];
        schemaId: number;
    };
}
export default Enum;
