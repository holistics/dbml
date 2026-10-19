import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type DatabaseType from '../../types/model_structure/database';
import type DbStateType from '../../types/model_structure/dbState';
import type { ArchSettings, Node as RawNode } from '@dbml/parse';

// An architecture node: `Server "API 1" as api1`
class Node extends Element {
  declare id: number;
  name: string;
  alias: string | null;
  kindId: number | null;
  type: string | null;
  image: string | null;
  settings: ArchSettings;
  note: string | null;
  noteToken: Token | null;
  groupId: number | null;
  database: DatabaseType;
  dbState: DbStateType;

  constructor ({
    name, alias, kind, type, image, settings, note, token, database,
  }: RawNode & { database: any }) {
    super(token as Token);
    this.name = name;
    this.alias = alias;
    this.kindId = database.findKind(kind)?.id ?? null;
    this.type = type;
    this.image = image;
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
      type: this.type,
      image: this.image,
      settings: this.settings,
      note: this.note,
    };
  }

  normalize (model: NormalizedModel) {
    model.nodes![this.id] = {
      id: this.id,
      ...this.export(),
      kindId: this.kindId,
      groupId: this.groupId,
    };
  }
}

export default Node;
