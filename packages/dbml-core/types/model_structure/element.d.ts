import type { Filepath } from '@dbml/parse';

export type Color = `#${string}` | 'none';

export interface Token {
    end: {
        column: number;
        line: number;
        offset: number;
    };
    start: {
        column: number;
        line: number;
        offset: number;
    };
    filepath?: Filepath;
}

export interface RawNote {
    value: string;
    token: Token;
}

declare class Element {
    token: Token;
    id: number;
    selection: string;
    constructor(token: Token);
    bind(selection: any): void;
    error(message: string): void;
    pushMetadata(meta: import('./metadata').default): void;
    get metadata(): { [key: string]: unknown };
    get metadataIds(): number[];
}
export default Element;
