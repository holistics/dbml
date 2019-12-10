import Element from './element';
import Endpoint from './endpoint';

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
  constructor ({ name, endpoints, onDelete, onUpdate, token, database = {} } = {}) {
    super(token);
    this.name = name;
    this.onDelete = onDelete;
    this.onUpdate = onUpdate;
    this.database = database;
    this.endpoints = [];

    this.processEndpoints(endpoints);
  }

  processEndpoints (rawEndpoints) {
    rawEndpoints.forEach((endpoint) => {
      this.endpoints.push(new Endpoint({ ...endpoint, ref: this }));
    });

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
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  shallowExport () {
    return {
      name: this.name,
    };
  }

  exportChild () {
    return {
      endpoints: this.endpoints.map(e => e.export()),
    };
  }

  exportChildIds () {
    return {
      endpoint_ids: this.endpoints.map(e => e.id),
    };
  }

  normalize (model) {
    model.refs = {
      ...model.refs,
      [this.id]: {
        ...this.shallowExport(),
        ...this.exportChildIds(),
      },
    };

    this.endpoints.forEach((endpoint) => endpoint.normalize(model));
  }
}

export default Ref;
