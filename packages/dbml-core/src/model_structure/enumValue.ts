import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element, { Token } from './element';
import Enum from './enum';

interface RawEnumValue {
    name: String
    token: Token
    note: String
    _enum: Enum
}

class EnumValue extends Element {
    name: String
    note: String
    _enum: Enum
    dbState: DbState

    constructor({ name, token, note, _enum }: RawEnumValue) {
        super(token);
        if (!name) { this.error('Enum value must have a name'); }
        this.name = name;
        this.note = note;
        this._enum = _enum;
        this.dbState = this._enum.dbState;
        this.generateId();
    }

    generateId() {
        this.id = this.dbState.generateId('enumValueId');
    }

    export() {
        return {
            ...this.shallowExport(),
        };
    }

    exportParentIds() {
        return {
            enumId: this._enum.id,
        };
    }

    shallowExport() {
        return {
            name: this.name,
            note: this.note,
        };
    }

    normalize(model: NormalizedDatabase) {
        model.enumValues = {
            ...model.enumValues,
            [this.id]: {
                id: this.id,
                ...this.shallowExport(),
                ...this.exportParentIds(),
            },
        };
    }
}

export interface NormalizedEnumValue {
    [_id: number]: {
        id: number
        name: String
        note: String
        enumId: number
    }
}

export default EnumValue;
