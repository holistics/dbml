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

class ElementError extends Error {
  location: Token;
  error: string;

  constructor (message: string, location: Token) {
    super(message);
    this.location = location;
    this.error = 'error';
  }
}

class Element {
  token: Token;
  selection: any;

  constructor (token: Token) {
    this.token = token;
  }

  bind (selection: any) {
    this.selection = selection;
  }

  error (message: string) {
    throw new ElementError(message, this.token);
  }
}

export default Element;
