import { NormalizedModel } from './database';
import DbState from './dbState';
import Element from './element';
import Index from './indexes';
declare class IndexColumn extends Element {
    type: any;
    value: any;
    index: Index;
    dbState: DbState;
    constructor({ type, value, index }: {
        type: any;
        value: any;
        index: any;
    });
    generateId(): void;
    export(): {
        type: any;
        value: any;
    };
    exportParentIds(): {
        indexId: number;
    };
    shallowExport(): {
        type: any;
        value: any;
    };
    normalize(model: NormalizedModel): void;
}
export interface NormalizedIndexColumn {
    id: number;
    type: string;
    value: string;
    indexId: number;
}

export interface NormalizedIndexColumnIdMap {
    [_id: number]: NormalizedIndexColumn;
}

export default IndexColumn;
