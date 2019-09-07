import Element from './element';

/**
 * Compare two pairs of objects
 * @param {Array} pair1
 * @param {Array} pair2
 * @returns {Boolean}
 */
function isEqualPair (pair1, pair2) {
  return pair1[0].equals(pair2[0]) && pair1[1].equals(pair2[1]);
}

class Ref extends Element {
  constructor ({ name, endpoints, token, onUpdate, onDelete } = {}) {
    super(token);
    this.name = name;
    this.endpoints = endpoints;
    this.onUpdate = onUpdate;
    this.onDelete = onDelete;
    if (this.endpoints[0].equals(this.endpoints[1])) {
      this.error('Two endpoints are the same');
    }
  }

  equals (ref) {
    return isEqualPair(this.endpoints, ref.endpoints)
      || isEqualPair(this.endpoints, ref.endpoints.slice().reverse());
  }

  export () {
    return {
      name: this.name,
      endpoints: this.endpoints.map(e => e.export()),
      onUpdate: this.onUpdate,
      onDelete: this.onDelete,
    };
  }
}

export default Ref;
