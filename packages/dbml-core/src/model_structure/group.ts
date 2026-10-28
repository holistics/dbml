import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type DatabaseType from '../../types/model_structure/database';
import type DbStateType from '../../types/model_structure/dbState';
import type { ArchElementType } from '../../types/model_structure/link';
import type { ArchRef, ArchSettings, Group as RawGroup } from '@dbml/parse';

// Members are resolved once every element exists (`Database.processArch`).
class Group extends Element {
  declare id: number;
  name: string;
  alias: string | null;
  // Handles and roles as written; `childIds` and `childTypes` hold the elements they name, in the same order
  children: ArchRef[];
  childIds: number[];
  childTypes: ArchElementType[];
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
    this.childTypes = [];
    this.settings = settings;
    this.note = note?.value ?? null;
    this.noteToken = (note?.token as Token) ?? null;
    this.groupId = null;
    this.database = database;
    this.dbState = database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('groupId');
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
      childTypes: this.childTypes,
      groupId: this.groupId,
    };
  }
}

export default Group;
