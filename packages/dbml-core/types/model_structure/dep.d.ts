import Element, { RawNote, Token } from './element';
import { NormalizedDatabase } from './database';
import Table from './table';
import Field from './field';
import Database from 'model_structure/database';
import DbState from 'model_structure/dbState';

interface RawDep {
    name?: string;
    note?: RawNote;
    downstreamTable: {
      schema?: string;
      table: string;
    };
    upstreamTables: {
      schema?: string;
      table: string;
    }[];
    fieldDeps: {
      downstreamField: string;
      upstreamFields: {
        ownerTableIdx: number;
        field: string;
      }[];
      note?: RawNote;
      name?: string;
    }[];
    token: Token;
}

declare class Dep extends Element {
    name?: string;
    note?: string;
    noteToken?: Token;
    downstreamTable: Table;
    upstreamTables: Table[];
    fieldDeps: {
      downstreamField: Field;
      upstreamFields: Field[];
      note?: string;
      noteToken?: Token;
      name?: string;
    }[];
    database: Database;
    dbState: DbState;
    id: number;

    constructor({ name, note, downstreamTable, upstreamTables, fieldDeps, token }: RawDep);
    generateId(): void;
    processTables(rawTable: any): void;
    processFieldDeps(rawFieldDeps: any): void;
    export(): {
      name?: string;
      note?: string;
      downstreamTable: {
        schema?: string;
        table: string;
      };
      upstreamTables: {
        schema?: string;
        table: string;
      }[];
      fieldDeps: {
        downstreamField: string;
        upstreamFields: {
          schema?: string;
          table: string;
          field: string;
        }[];
        note?: string;
        name?: string;
      }[];
    };
    shallowExport():  {
      name?: string;
      note?: string;
      downstreamTable: {
        schema?: string;
        table: string;
      };
      upstreamTables: {
        schema?: string;
        table: string;
      }[];
      fieldDeps: {
        downstreamField: string;
        upstreamFields: {
          schema?: string;
          table: string;
          field: string;
        }[];
        note?: string;
        name?: string;
      }[];
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedDep {
    [_id: number]: {
        id: number;
        note?: string;
        name?: string;
        downstreamTable: number;
        upstreamTables: number[];
        fieldDeps: {
          downstreamField: number;
          upstreamFields: number[];
          note?: string;
          name?: string;
        }[];
    };
}

export default Dep;
