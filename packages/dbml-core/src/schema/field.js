import Element from './element';

class Field extends Element {
  constructor ({ name, type, unique, pk, token, not_null, note, inline_refs, dbdefault,
    increment } = {}) {
    super(token);
    if (!name) { this.error('Field must have a name'); }
    if (!type) { this.error('Field must have a type'); }
    this.name = name;
    // type : { type_name, value }
    this.type = type;
    this.unique = unique;
    this.pk = pk;
    this.isConnected = false;
    this.not_null = not_null;
    this.note = note;
    this.inline_refs = inline_refs;
    this.dbdefault = dbdefault;
    this.increment = increment;
    // this.settings = settings; // debugging purpose
    // this.enumRef = null;
  }

  connect () {
    this.isConnected = true;
  }

  export () {
    return {
      name: this.name,
      type: this.type,
      unique: this.unique,
      pk: this.pk,
      not_null: this.not_null,
      note: this.note,
      dbdefault: this.dbdefault,
      increment: this.increment,
      // settings: this.settings, // debugging purpose
    };
  }
}

export default Field;
