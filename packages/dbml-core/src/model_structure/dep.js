import { get } from 'lodash-es';
import { DEFAULT_SCHEMA_NAME } from './config';
import DepEdge from './dep_edge';
import Element from './element';

class Dep extends Element {
  /**
   * @param {import('../../types/model_structure/dep').RawDep} param0
   */
  constructor ({
    name, color, note, custom, edges, token, schema = {},
  } = {}) {
    super(token);
    /** @type {string|null} */
    this.name = name ?? null;
    /** @type {string|undefined} */
    this.color = color;
    /** @type {string|null} */
    this.note = note ? get(note, 'value', note) : null;
    /** @type {import('../../types/model_structure/element').Token} */
    this.noteToken = note ? get(note, 'token', null) : null;
    /** @type {Record<string, string|number|boolean|null>|null} */
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
   * @param {import('../../types/model_structure/dep_edge').RawDepEdge[]} rawEdges
   */
  processEdges (rawEdges) {
    rawEdges.forEach((rawEdge) => {
      const upSchema = rawEdge.upstream?.schemaName || DEFAULT_SCHEMA_NAME;
      const downSchema = rawEdge.downstream?.schemaName || DEFAULT_SCHEMA_NAME;
      const upTable = rawEdge.upstream?.tableName;
      const downTable = rawEdge.downstream?.tableName;
      if (upSchema === downSchema && upTable === downTable) {
        this.error(`Self-loop Dep edge not allowed: "${upSchema}"."${upTable}" cannot depend on itself`);
      }
      this.edges.push(new DepEdge({ ...rawEdge, dep: this }));
    });
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
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
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
