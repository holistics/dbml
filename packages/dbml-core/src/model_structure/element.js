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
   * The merged metadata key/value pairs for this element. The compiler
   * (@dbml/parse) owns metadata merging and attaches the final merged values
   * onto each element; @dbml/core only reads them.
   * @returns {{ [key: string]: unknown }}
   */
  get metadata () {
    return this._metadata ?? {};
  }

  /**
   * @param {string} message
   */
  error (message) {
    throw new ElementError(message, this.token);
  }
}

export default Element;
