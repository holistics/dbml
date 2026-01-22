import { NormalizedModel } from './database';
import Element, { Token } from './element';
import Field from './field';
import Table from './table';
import TablePartial from './tablePartial';

export interface RawCheck {
    token: Token;
    expression: string;
    name?: string;
}

declare class Check extends Element {
    name: string;
    expression: string;
    table: Table;
    column: Field | null;
    injectedPartial: TablePartial | null;

    constructor({ token, name, expression, table, column, injectedPartial }: RawCheck & {
        table: Table;
        column?: Field | null;
        injectedPartial?: TablePartial | null;
    });
    generateId(): void;
    export(): {
        name: string;
        expression: string;
    };
    exportParentIds(): {
        tableId: number;
        columnId: number | null;
        injectedPartialId: number | null;
    };
    shallowExport(): {
        name: string;
        expression: string;
    };
    normalize(model: NormalizedModel): void;
}

export interface NormalizedCheck {
    id: number;
    name: string;
    expression: string;
    tableId: number;
    columnId: number | null;
    injectedPartialId: number | null;
}

export interface NormalizedCheckIdMap {
    [_id: number]: NormalizedCheck;
}

export default Check;
