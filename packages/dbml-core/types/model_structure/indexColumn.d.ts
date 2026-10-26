import { NormalizedModel } from './database';
import DbState from './dbState';
import Element, { Token } from './element';
import Index from './indexes';

export interface RawIndexColumn {
    type: any;
    value: any;
    sortOrder?: 'desc';
    index: Index;
    token: Token;
}

declare class IndexColumn extends Element {
    type: any;
    value: any;
    sortOrder?: 'desc';
    index: Index;
    dbState: DbState;
    constructor({ type, value, sortOrder, index }: {
        type: any;
        value: any;
        sortOrder?: 'desc';
        index: any;
    });
    generateId(): void;
    export(): {
        type: any;
        value: any;
        sortOrder?: 'desc';
    };
    exportParentIds(): {
        indexId: number;
    };
    shallowExport(): {
        type: any;
        value: any;
        sortOrder?: 'desc';
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedIndexColumn {
    id: number;
    type: string;
    value: string;
    sortOrder?: 'desc';
    indexId: number;
}

export interface NormalizedIndexColumnIdMap {
    [_id: number]: NormalizedIndexColumn;
}

export default IndexColumn;
