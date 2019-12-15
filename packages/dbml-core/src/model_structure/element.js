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
    this.generateId();
  }

  static incIdCounter () {
    Element.idCounter += 1;
  }

  static resetIdCounter () {
    Element.idCounter = 1;
  }

  generateId () {
    this.id = Element.idCounter;
    Element.incIdCounter();
  }

  bind (selection) {
    this.selection = selection;
  }

  error (message) {
    throw new ElementError(message, this.token);
  }
}

Element.idCounter = 1;

export default Element;
/* eslint-enable */
