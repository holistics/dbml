import { NormalizedDatabase } from './database';
import DbState from './dbState';
import Element from './element';
import Index from './indexes';

class IndexColumn extends Element {
    type: any
    value: any
    index: Index
    dbState: DbState

    constructor({ type, value, index }) {
        super(undefined);
        this.type = type;
        this.value = value;
        this.index = index;
        this.dbState = this.index.dbState;
        this.generateId();
    }

    generateId() {
        this.id = this.dbState.generateId('indexColumnId');
    }

    export() {
        return {
            ...this.shallowExport(),
        };
    }

    exportParentIds() {
        return {
            indexId: this.index.id,
        };
    }

    shallowExport() {
        return {
            type: this.type,
            value: this.value,
        };
    }

    normalize(model: NormalizedDatabase) {
        model.indexColumns = {
            ...model.indexColumns,
            [this.id]: {
                id: this.id,
                ...this.shallowExport(),
                ...this.exportParentIds(),
            },
        };
    }
}

export interface NormalizedIndexColumn {
    [_id: number]: {
        id: number
        type: any
        value: any
        indexId: number
    }
}

export default IndexColumn;
