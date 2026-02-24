import Element, { Token } from './element';
import Endpoint from './endpoint';
import Schema from './schema';
import DbState from './dbState';
import Database, { NormalizedModel } from './database';
import TablePartial from './tablePartial';
import { DEFAULT_SCHEMA_NAME } from './config';

interface RawRef {
  name: string;
  color?: string;
  endpoints: Endpoint[];
  onDelete: any;
  onUpdate: any;
  token: Token;
  schema: Schema;
  injectedPartial?: TablePartial | null;
}

export interface NormalizedRef {
  id: number;
  name: string | null;
  color?: string;
  onUpdate?: string;
  onDelete?: string;
  schemaId: number;
  endpointIds: number[];
  injectedPartialId?: number;
}

export interface NormalizedRefIdMap {
  [_id: number]: NormalizedRef;
}

/**
 * Compare two pairs of objects
 * @param {Array} pair1
 * @param {Array} pair2
 * @returns {Boolean}
 */
function isEqualPair (pair1: any[], pair2: any[]): boolean {
  return pair1[0].equals(pair2[0]) && pair1[1].equals(pair2[1]);
}

class Ref extends Element {
  name: string;
  color?: string;
  endpoints: Endpoint[];
  onDelete: any;
  onUpdate: any;
  schema: Schema;
  dbState: DbState;
  database!: Database;
  injectedPartial?: TablePartial;

  constructor ({
    name, color, endpoints, onDelete, onUpdate, token, schema = {} as Schema, injectedPartial = null,
  }: RawRef) {
    super(token);
    this.name = name;
    this.color = color;
    this.onDelete = onDelete;
    this.onUpdate = onUpdate;
    this.endpoints = [];
    this.schema = schema;
    this.injectedPartial = injectedPartial ?? undefined;
    this.dbState = this.schema.dbState;
    this.generateId();

    this.processEndpoints(endpoints);
  }

  generateId (): void {
    this.id = this.dbState.generateId('refId');
  }

  processEndpoints (rawEndpoints: any): void {
    rawEndpoints.forEach((endpoint: any) => {
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

  equals (ref: any): any {
    return isEqualPair(this.endpoints, ref.endpoints)
      || isEqualPair(this.endpoints, ref.endpoints.slice().reverse());
  }

  export (): ReturnType<Ref['shallowExport']> & ReturnType<Ref['exportChild']> {
    return {
      ...this.shallowExport(),
      ...this.exportChild(),
    };
  }

  shallowExport (): {
    name: string;
    color: string | undefined;
    onDelete: any;
    onUpdate: any;
    injectedPartialId: number | undefined;
  } {
    return {
      name: this.name,
      color: this.color,
      onDelete: this.onDelete,
      onUpdate: this.onUpdate,
      injectedPartialId: this.injectedPartial?.id,
    };
  }

  exportChild (): { endpoints: { schemaName: string; tableName: string; fieldNames: string[]; relation: any }[] } {
    return {
      endpoints: this.endpoints.map((e) => e.export()),
    };
  }

  exportChildIds (): { endpointIds: number[] } {
    return {
      endpointIds: this.endpoints.map((e) => e.id),
    };
  }

  exportParentIds (): { schemaId: number } {
    return {
      schemaId: this.schema.id,
    };
  }

  normalize (model: NormalizedModel): void {
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
