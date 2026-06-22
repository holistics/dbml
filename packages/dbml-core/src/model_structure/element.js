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
   * Register a Metadata element that targets this element (back-reference).
   * @param {import('../../types/model_structure/metadata').default} meta
   */
  pushMetadata (meta) {
    if (!this._metadata) {
      /** @type {import('../../types/model_structure/metadata').default[]} */
      this._metadata = [];
    }
    this._metadata.push(meta);
  }

  /**
   * Merged key/value pairs from all Metadata elements targeting this element.
   * Later blocks override earlier ones on key conflict (last wins).
   * @returns {{ [key: string]: unknown }}
   */
  get metadata () {
    if (!this._metadata || this._metadata.length === 0) return {};
    return Object.assign({}, ...this._metadata.map((m) => m.values));
  }

  /**
   * Ids of the Metadata elements targeting this element.
   * @returns {number[]}
   */
  get metadataIds () {
    return this._metadata ? this._metadata.map((m) => m.id) : [];
  }

  /**
   * @param {string} message
   */
  error (message) {
    throw new ElementError(message, this.token);
  }
}

export default Element;
