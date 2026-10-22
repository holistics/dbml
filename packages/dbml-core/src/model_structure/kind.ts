import Element from './element';
import type { Token } from '../../types/model_structure/element';
import type { NormalizedModel } from '../../types/model_structure/database';
import type DatabaseType from '../../types/model_structure/database';
import type DbStateType from '../../types/model_structure/dbState';
import type { Kind as RawKind, KindCategory } from '@dbml/parse';

// Built-in, or declared with `Kind`
class Kind extends Element {
  declare id: number;
  name: string;
  icon: string;
  glyph: string[] | null;
  image: string | null;
  category: KindCategory;
  color: string | null;
  builtin: boolean;
  database: DatabaseType;
  dbState: DbStateType;

  constructor ({
    name, icon, glyph, image, category, color, builtin, token, database,
  }: RawKind & { database: any }) {
    super(token as Token);
    this.name = name;
    this.icon = icon;
    this.glyph = glyph;
    this.image = image;
    this.category = category;
    this.color = color;
    this.builtin = builtin;
    this.database = database;
    this.dbState = database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('kindId');
  }

  export () {
    return {
      name: this.name,
      icon: this.icon,
      glyph: this.glyph,
      image: this.image,
      category: this.category,
      color: this.color,
      builtin: this.builtin,
    };
  }

  normalize (model: NormalizedModel) {
    model.kinds![this.id] = {
      id: this.id,
      ...this.export(),
    };
  }
}

export default Kind;
