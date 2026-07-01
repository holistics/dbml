import { CARDINALITY_SOME, CARDINALITY_MANY, CARDINALITY_ONE, CARDINALITY_MAYBE } from '@dbml/parse';
import { DEFAULT_SCHEMA_NAME } from './config';
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
  /**
   * @param {import('../../types/model_structure/ref').RawRef} param0
   */
  constructor ({
    name, color, endpoints, onDelete, onUpdate, inactive, token, schema = {}, injectedPartial = null,
  } = {}) {
    super(token);
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.color = color;
    /** @type {any} */
    this.onDelete = onDelete;
    /** @type {any} */
    this.onUpdate = onUpdate;
    /** @type {boolean} */
    this.inactive = inactive;
    /** @type {import('../../types/model_structure/endpoint').default[]} */
    this.endpoints = [];
    /** @type {import('../../types/model_structure/schema').default} */
    this.schema = schema;
    /** @type {import('../../types/model_structure/tablePartial').default} */
    this.injectedPartial = injectedPartial;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processEndpoints(endpoints);
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('refId');
  }

  /**
   * @param {any[]} rawEndpoints
   */
  processEndpoints (rawEndpoints) {
    rawEndpoints.forEach((endpoint) => {
      this.endpoints.push(new Endpoint({ ...endpoint, ref: this }));
      if (endpoint.schemaName === DEFAULT_SCHEMA_NAME) {
        // this.schema.database.hasDefaultSchema = true;
      }
    });

    if (this.endpoints[0].equals(this.endpoints[1])) {
      this.error('Two endpoints are the same');
    }

    if (this.endpoints[0].fields.length !== this.endpoints[1].fields.length) {
      this.error('Two endpoints have unequal number of fields');
    }

    // If an endpoint's FK fields are all nullable, both sides become optional
    for (const ep of this.endpoints) {
      const allNullable = ep.fields.length > 0
        && ep.fields.every((f) => !f.not_null && !f.pk);
      if (allNullable) {
        if (ep.relation === CARDINALITY_SOME) ep.relation = CARDINALITY_MANY;
        else if (ep.relation === CARDINALITY_ONE) ep.relation = CARDINALITY_MAYBE;
      }
    }
  }

  /**
   * @param {import('../../types/model_structure/ref').default} ref
   * @returns {boolean}
   */
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
      color: this.color,
      onDelete: this.onDelete,
      onUpdate: this.onUpdate,
      inactive: this.inactive,
      injectedPartialId: this.injectedPartial?.id,
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

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.refs[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.endpoints.forEach((endpoint) => endpoint.normalize(model));
  }
}

export default Ref;
