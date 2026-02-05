import { NormalizedModel } from './database';
import DbState from './dbState';
import Element, { Token, RawNote } from './element';
import Enum from './enum';
interface RawEnumValue {
    name: string;
    token: Token;
    note: RawNote;
    _enum: Enum;
}
declare class EnumValue extends Element {
    name: string;
    note: string;
    noteToken: Token;
    _enum: Enum;
    dbState: DbState;
    constructor({ name, token, note, _enum }: RawEnumValue);
    generateId(): void;
    export(): {
        name: string;
        note: string;
    };
    exportParentIds(): {
        enumId: number;
    };
    shallowExport(): {
        name: string;
        note: string;
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedEnumValue {
    id: number;
    name: string;
    note: string | null;
    enumId: number;
}

export interface NormalizedEnumValueIdMap {
    [_id: number]: NormalizedEnumValue;
}

export default EnumValue;
