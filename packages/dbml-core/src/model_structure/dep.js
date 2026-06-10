import { get } from 'lodash-es';
import DepEdge from './dep_edge';
import Element from './element';

class Dep extends Element {
  /**
   * @param {{ name?: string|null, note?: any, custom?: object|null, edges: any[], token?: any, schema?: any }} param0
   */
  constructor ({
    name, note, custom, edges, token, schema = {},
  } = {}) {
    super(token);
    /** @type {string|null} */
    this.name = name ?? null;
    /** @type {string|null} */
    this.note = note ? get(note, 'value', note) : null;
    /** @type {any} */
    this.noteToken = note ? get(note, 'token', null) : null;
    /** @type {object|null} */
    this.custom = custom ?? null;
    /** @type {import('./dep_edge').default[]} */
    this.edges = [];
    /** @type {import('./schema').default} */
    this.schema = schema;
    /** @type {import('./dbState').default} */
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processEdges(edges ?? []);
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('depId');
  }

  /**
   * @param {any[]} rawEdges
   */
  processEdges (rawEdges) {
    rawEdges.forEach((rawEdge) => {
      this.edges.push(new DepEdge({ ...rawEdge, dep: this }));
    });
  }

  /**
   * @param {import('./dep').default} dep
   * @returns {boolean}
   */
  equals (dep) {
    if (this.edges.length !== dep.edges.length) return false;
    return this.edges.every((edge, i) => edge.equals(dep.edges[i]));
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
      note: this.note,
      custom: this.custom,
    };
  }

  exportChild () {
    return {
      edges: this.edges.map((e) => e.export()),
    };
  }

  exportChildIds () {
    return {
      edgeIds: this.edges.map((e) => e.id),
    };
  }

  exportParentIds () {
    return {
      schemaId: this.schema.id,
    };
  }

  /**
   * @param {any} model
   */
  normalize (model) {
    model.deps[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.edges.forEach((edge) => edge.normalize(model));
  }
}

export default Dep;
