import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { Token } from './element';
import Enum from './enum';
interface RawEnumValue {
    name: String;
    token: Token;
    note: String;
    _enum: Enum;
}
declare class EnumValue extends Element {
    name: String;
    note: String;
    _enum: Enum;
    dbState: DbState;
    constructor({ name, token, note, _enum }: RawEnumValue);
    generateId(): void;
    export(): {
        name: String;
        note: String;
    };
    exportParentIds(): {
        enumId: number;
    };
    shallowExport(): {
        name: String;
        note: String;
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedEnumValue {
    [_id: number]: {
        id: number;
        name: String;
        note: String;
        enumId: number;
    };
}
export default EnumValue;
