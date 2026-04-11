export interface Token {
  end: { column: number; line: number; offset: number };
  start: { column: number; line: number; offset: number };
}

export interface RawNote {
  value: string;
  token: Token;
}

class ElementError extends Error {
  location: Token;
  error: string;

  constructor (message: string, location: Token = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }) {
    super(message);
    this.location = location;
    this.error = 'error';
  }
}

class Element {
  token: Token;
  id!: number;
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
