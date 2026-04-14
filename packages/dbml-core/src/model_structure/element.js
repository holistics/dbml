class ElementError extends Error {
  /**
   * @param {string} message
   * @param {import('../../types/model_structure/element').Token} location
   */
  constructor (message, location = { start: { line: 1, column: 1 } }) {
    super(message);
    /** @type {import('../../types/model_structure/element').Token} */
    this.location = location;
    /** @type {string} */
    this.error = 'error';
  }
}

class Element {
  constructor (token) {
    /** @type {import('../../types/model_structure/element').Token} */
    this.token = token;
  }

  /**
   * @param {any} selection
   */
  bind (selection) {
    /** @type {any} */
    this.selection = selection;
  }

  /**
   * @param {string} message
   */
  error (message) {
    throw new ElementError(message, this.token);
  }
}

export default Element;
