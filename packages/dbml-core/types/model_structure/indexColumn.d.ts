import { NormalizedDatabase } from './database';
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
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedIndexColumn {
    [_id: number]: {
        id: number;
        type: any;
        value: any;
        indexId: number;
    };
}
export default IndexColumn;
