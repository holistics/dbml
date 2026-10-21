import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type DatabaseType from '../../types/model_structure/database';
import type DbStateType from '../../types/model_structure/dbState';
import type { ArchSettings, Group as RawGroup } from '@dbml/parse';

// Members are resolved once every element exists (`Database.processArch`).
class Group extends Element {
  declare id: number;
  name: string;
  alias: string | null;
  // Handles as written; `childIds` holds the elements they name
  children: string[];
  childIds: number[];
  settings: ArchSettings;
  note: string | null;
  noteToken: Token | null;
  groupId: number | null;
  database: DatabaseType;
  dbState: DbStateType;

  constructor ({
    name, alias, children, settings, note, token, database,
  }: RawGroup & { database: any }) {
    super(token as Token);
    this.name = name;
    this.alias = alias;
    this.children = children;
    this.childIds = [];
    this.settings = settings;
    this.note = note?.value ?? null;
    this.noteToken = (note?.token as Token) ?? null;
    this.groupId = null;
    this.database = database;
    this.dbState = database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('elementId');
  }

  export () {
    return {
      name: this.name,
      alias: this.alias,
      settings: this.settings,
      note: this.note,
    };
  }

  normalize (model: NormalizedModel) {
    model.groups![this.id] = {
      id: this.id,
      ...this.export(),
      childIds: this.childIds,
      groupId: this.groupId,
    };
  }
}

export default Group;
