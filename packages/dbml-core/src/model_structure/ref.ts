import Element, { Token } from './element';
import Endpoint from './endpoint';
import { DEFAULT_SCHEMA_NAME } from './config';
import Schema from './schema';
import TablePartial from './tablePartial';
import DbState from './dbState';

export interface RawRef {
  name: string;
  color?: string;
  endpoints: any[];
  onDelete: any;
  onUpdate: any;
  token: Token;
  schema: Schema;
  injectedPartial?: TablePartial;
}

/**
 * Compare two pairs of objects
 */
function isEqualPair (pair1: Endpoint[], pair2: Endpoint[]): boolean {
  return pair1[0].equals(pair2[0]) && pair1[1].equals(pair2[1]);
}

class Ref extends Element {
  name: string;
  color?: string;
  onDelete: any;
  onUpdate: any;
  endpoints: Endpoint[];
  schema: Schema;
  injectedPartial?: TablePartial;
  dbState: DbState;

  constructor ({
    name, color, endpoints, onDelete, onUpdate, token, schema = {} as Schema, injectedPartial = undefined,
  }: RawRef) {
    super(token);
    this.name = name;
    this.color = color;
    this.onDelete = onDelete;
    this.onUpdate = onUpdate;
    this.endpoints = [];
    this.schema = schema;
    this.injectedPartial = injectedPartial;
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processEndpoints(endpoints);
  }

  generateId () {
    this.id = this.dbState.generateId('refId');
  }

  processEndpoints (rawEndpoints: any[]) {
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
    // TODO: Handle Error with different number of fields
  }

  equals (ref: Ref): boolean {
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

  normalize (model: any) {
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
