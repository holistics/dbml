import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { Token } from './element';
import EnumValue from './enumValue';
import Field from './field';
import Schema from './schema';
interface RawEnum {
    name: String;
    token: Token;
    values: EnumValue[];
    note: String;
    schema: Schema;
}
declare class Enum extends Element {
    name: String;
    token: Token;
    values: EnumValue[];
    note: String;
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
            name: String;
            note: String;
        }[];
        name: String;
        note: String;
    };
    exportChild(): {
        values: {
            name: String;
            note: String;
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
        name: String;
        note: String;
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedEnum {
    [_id: number]: {
        id: number;
        name: String;
        note: String;
        valueIds: number[];
        fieldIds: number[];
        schemaId: number;
    };
}
export default Enum;
