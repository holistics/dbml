import Element from './element';

class Note extends Element {
  constructor ({
    name, content, headerColor, token, database = {},
  } = {}) {
    super(token);
    this.name = name;
    this.content = content;
    this.headerColor = headerColor;
    this.database = database;
    this.dbState = this.database.dbState;
    this.generateId();
  }

  generateId () {
    this.id = this.dbState.generateId('noteId');
  }

  export () {
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
        ...this.export(),
      },
    };
  }
}

export default Note;
