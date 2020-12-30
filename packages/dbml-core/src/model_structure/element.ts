export interface Token {
  end: {
    column: number
    line: number
    offset: number
  }
  start: {
    column: number
    line: number
    offset: number
  }
}

/* eslint-disable */
class ElementError extends Error {
  location: {
    start: {
      line: number
      column: number
    }
  }
  constructor (message: string, location = { start: { line: 1, column: 1 } }) {
    super(message);
    this.location = location;
  }
}

class Element {
  token: Token
  id: number
  selection: String
  
  constructor (token: Token) {
    this.token = token;
  }

  bind (selection) {
    this.selection = selection;
  }

  error (message: string) {
    throw new ElementError(message, this.token);
  }
}

export default Element;
/* eslint-enable */
