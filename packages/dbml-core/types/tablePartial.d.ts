export default TablePartial;
declare class TablePartial extends Element {
    constructor({ name, note, fields, indexes, token, headerColor, noteToken, dbState, }?: {
        name: any;
        note: any;
        fields?: any[];
        indexes?: any[];
        token: any;
        headerColor: any;
        noteToken?: any;
        dbState: any;
    });
    name: any;
    note: any;
    noteToken: any;
    headerColor: any;
    fields: any[];
    indexes: any[];
    dbState: any;
    generateId(): void;
    id: any;
    export(): {
        name: any;
        note: any;
        headerColor: any;
        fields: any[];
        indexes: any[];
    };
    shallowExport(): {
        name: any;
        note: any;
        headerColor: any;
        fields: any[];
        indexes: any[];
    };
    normalize(model: any): void;
}
import Element from './element';
