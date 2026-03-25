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
}
export default Element;
