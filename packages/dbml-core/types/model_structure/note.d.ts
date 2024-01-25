import Element, { Token } from './element';
import Schema from './schema';
import DbState from './dbState';
import { NormalizedDatabase } from './database';
interface RawStickyNote {
    name: string;
    content: string;
    schema: Schema;
    token: Token;
    headerColor: string;
}
declare class Note extends Element {
    name: string;
    content: string;
    noteToken: Token;
    schema: Schema;
    headerColor: string;
    dbState: DbState;
    id: number;
    constructor({ name, content, schema, token, headerColor }: RawStickyNote);
    generateId(): void;
    export(): {
        name: string;
        content: string;
        headerColor: string;
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedNote {
    [id: number]: {
        id: number;
        name: string;
        content: string;
        headerColor: string;
    };
}
export default Note;
