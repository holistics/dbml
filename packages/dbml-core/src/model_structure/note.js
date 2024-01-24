import Element from './element';

class Note extends Element {
  constructor ({
    name, content, headerColor, token, schema = {},
  } = {}) {
    super(token);
    this.name = name;
    this.content = content;
    this.headerColor = headerColor;
    this.schema = schema;
    this.dbState = this.schema.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('noteId');
  }

  shallowExport () {
    return {
      name: this.name,
      content: this.content,
      headerColor: this.headerColor,
    };
  }

  normalize (model) {
    model.notes = {
      ...model.notes,
      [this.id]: {
        id: this.id,
        ...this.shallowExport(),
      },
    };
  }
}

export default Note;
