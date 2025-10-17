import { NormalizedDatabase } from './database';
import Element, { Token } from './element';
import Field from './field';
import Table from './table';
import TablePartial from './tablePartial';

interface RawConstraint {
    token: Token;
    name: string;
    expression: any;
    table: Table;
    column?: Field | null;
    injectedPartial?: TablePartial | null;
}

declare class Constraint extends Element {
    name: string;
    expression: any;
    table: Table;
    column: Field | null;
    injectedPartial: TablePartial | null;

    constructor({ token, name, expression, table, column, injectedPartial }: RawConstraint);
    generateId(): void;
    export(): {
        name: string;
        expression: any;
    };
    exportParentIds(): {
        tableId: number;
        columnId: number | null;
        injectedPartialId: number | null;
    };
    shallowExport(): {
        name: string;
        expression: any;
    };
    normalize(model: NormalizedDatabase): void;
}

export interface NormalizedConstraint {
    [_id: number]: {
        id: number;
        name: string;
        expression: any;
        tableId: number;
        columnId: number | null;
        injectedPartialId: number | null;
    };
}

export default Constraint;
