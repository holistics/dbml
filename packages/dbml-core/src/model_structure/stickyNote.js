import Element from './element';

class StickyNote extends Element {
  /**
   * @param {import('../../types/model_structure/stickyNote').RawStickyNote} param0
   */
  constructor ({
    name, content, color, token, database = {},
  } = {}) {
    super(token);
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.content = content;
    /** @type {string | undefined} */
    this.color = color;
    /** @type {import('../../types/model_structure/database').default} */
    this.database = database;
    /** @type {import('../../types/model_structure/dbState').default} */
    this.dbState = this.database.dbState;
    this.generateId();
  }

  generateId () {
    /** @type {number} */
    this.id = this.dbState.generateId('noteId');
  }

  export () {
    return {
      name: this.name,
      content: this.content,
      color: this.color,
      metadata: this.metadata,
    };
  }

  /**
   * @param {import('../../types/model_structure/database').NormalizedDatabase} model
   */
  normalize (model) {
    model.notes[this.id] = {
      id: this.id,
      ...this.export(),
      metadataIds: this.metadataIds,
    };
  }
}

export default StickyNote;
