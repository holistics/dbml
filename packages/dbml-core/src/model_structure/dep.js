import Element from './element';
import Endpoint from './endpoint';
import { DEFAULT_SCHEMA_NAME } from './config';

function isEqualPair (pair1, pair2) {
  return pair1[0].equals(pair2[0]) && pair1[1].equals(pair2[1]);
}

class Dep extends Element {
  constructor ({
    name, color, endpoints, note, token, schema = {},
  } = {}) {
    super(token);
    this.name = name;
    this.color = color;
    this.note = note?.value || note || null;
    this.noteToken = note?.token || null;
    this.endpoints = [];
    this.schema = schema;
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processEndpoints(endpoints);
  }

  generateId () {
    this.id = this.dbState.generateId('depId');
  }

  processEndpoints (rawEndpoints) {
    rawEndpoints.forEach((endpoint) => {
      this.endpoints.push(new Endpoint({ ...endpoint, ref: this, allowEmptyFields: true }));
      if (endpoint.schemaName === DEFAULT_SCHEMA_NAME) {
        // this.schema.database.hasDefaultSchema = true;
      }
    });

    if (this.endpoints[0].equals(this.endpoints[1])) {
      this.error('Two endpoints are the same');
    }
  }

  equals (dep) {
    return isEqualPair(this.endpoints, dep.endpoints)
      || isEqualPair(this.endpoints, dep.endpoints.slice().reverse());
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
      color: this.color,
      note: this.note,
    };
  }

  exportChild () {
    return {
      endpoints: this.endpoints.map((e) => e.export()),
    };
  }

  exportChildIds () {
    return {
      endpointIds: this.endpoints.map((e) => e.id),
    };
  }

  exportParentIds () {
    return {
      schemaId: this.schema.id,
    };
  }

  normalize (model) {
    model.deps[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.endpoints.forEach((endpoint) => endpoint.normalize(model));
  }
}

export default Dep;
