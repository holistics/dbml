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

class ElementError extends Error {
  location: { start: { line: number; column: number } };
  error: string;

  constructor (
    message: string,
    location: { start: { line: number; column: number } } = { start: { line: 1, column: 1 } },
  ) {
    super(message);
    this.location = location;
    this.error = 'error';
  }
}

class Element {
  token: Token;
  id!: number;
  selection!: string;

  constructor (token: Token) {
    this.token = token;
  }

  bind (selection: any): void {
    this.selection = selection;
  }

  error (message: string): void {
    throw new ElementError(message, this.token);
  }
}

export default Element;
