/* eslint-disable */
class ElementError extends Error {
  constructor (message, location = { start: { line: 1, column: 1 } }) {
    super(message);
    this.location = location;
  }
}

class Element {
  constructor (token) {
    this.token = token;
  }

  bind (selection) {
    this.selection = selection;
  }

  error (message) {
    throw new ElementError(message, this.token);
  }
}

export default Element;
/* eslint-enable */
