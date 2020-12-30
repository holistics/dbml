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
declare class Element {
    token: Token;
    id: number;
    selection: String;
    constructor(token: Token);
    bind(selection: any): void;
    error(message: string): void;
}
export default Element;
