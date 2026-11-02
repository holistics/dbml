import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type DatabaseType from '../../types/model_structure/database';
import type DbStateType from '../../types/model_structure/dbState';
import type { ArchSettings, CustomMetadata, Node as RawNode } from '@dbml/parse';

// An architecture node: `Server "API 1" as api1`
class Node extends Element {
  declare id: number;
  name: string;
  alias: string | null;
  // The built-in role, in its declared spelling
  role: string;
  type: string | null;
  icon: string | null;
  settings: ArchSettings;
  metadata: CustomMetadata;
  note: string | null;
  noteToken: Token | null;
  groupId: number | null;
  database: DatabaseType;
  dbState: DbStateType;

  constructor ({
    name, alias, role, type, icon, settings, metadata = {}, note, token, database,
  }: RawNode & { database: any }) {
    super(token as Token);
    this.name = name;
    this.alias = alias;
    this.role = role;
    this.type = type;
    this.icon = icon;
    this.settings = settings;
    this.metadata = metadata;
    this.note = note?.value ?? null;
    this.noteToken = (note?.token as Token) ?? null;
    this.groupId = null;
    this.database = database;
    this.dbState = database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('nodeId');
  }

  export () {
    return {
      name: this.name,
      alias: this.alias,
      role: this.role,
      type: this.type,
      icon: this.icon,
      settings: this.settings,
      metadata: this.metadata,
      note: this.note,
    };
  }

  normalize (model: NormalizedModel) {
    model.nodes![this.id] = {
      id: this.id,
      ...this.export(),
      groupId: this.groupId,
    };
  }
}

export default Node;
