import Element from './element';
import { shouldPrintSchema } from './utils';

class Tag extends Element {
  constructor ({ name, note, token, schema = {} }) {
    super(token);
    this.name = name;
    this.note = note;
    this.tables = [];
    this.schema = schema;
    this.dbState = schema.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('tagId');
  }

  pushTable (table) {
    this.checkTable(table);
    this.tables.push(table);
  }

  checkTable (table) {
    if (this.tables.some(t => t.id === table.id)) {
      this.error(`Table ${shouldPrintSchema(this.schema)
        ? `${this.schema.name}.` : `` }${table.name} has already associated with tag "${this.name}"`);
    }
  }

  exportParentIds () {
    return {
      schemaId: this.schema.id,
    }
  }

  exportChildIds () {
    return {
      table_ids: this.tables.map(table => table.id),
    }
  }

  shallowExport () {
    return {
      name: this.name,
      note: this.note
    }
  }

  normalize (model) {
    model.tags = {
      ...model.tags,
      [this.id]: {
        id: this.id,
        ...this.shallowExport(),
        ...this.exportChildIds(),
        ...this.exportParentIds(),
      }
    }
  }
}

export default Tag;