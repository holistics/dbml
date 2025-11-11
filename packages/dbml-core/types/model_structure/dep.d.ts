import Element, { RawNote, Token } from './element';
import DbState from './dbState';
import { NormalizedDatabase } from './database';
import Table from './table';
import Field from './field';

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
      note?: string;
      name?: string;
    }[] | '*';
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
    }[] | '*';
    dbState: DbState;
    id: number;

    constructor({ name, note, downstreamTable, upstreamTables, fieldDeps, token }: RawDep);
    generateId(): void;
    processTables(rawTable: any): void;
    processFieldDeps(rawFieldDeps: any): void;
    export(): {
      name: string;
      note: string;
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
      }[] | '*';
    };
    shallowExport():  {
      name: string;
      note: string;
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
      }[] | '*';
    };
    normalize(model: NormalizedDatabase): void;
}
export interface NormalizedDep {
    [_id: number]: {
        id: number;
        note?: string;
        downstreamTable: number;
        upstreamTables: number[];
        fieldDeps: {
          downstreamField: number;
          upstreamFields: number[];
          note?: string;
          name?: string;
        }[] | '*';
    };
}

export default Dep;
