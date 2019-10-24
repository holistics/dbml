import _ from 'lodash';

class Exporter {
  constructor (schema = {}) {
    this.schema = schema;
  }

  static getIndexesFromSchema (schema) {
    const indexes = [];

    schema.tables.forEach((table) => {
      if (!_.isEmpty(table.indexes)) {
        // primary composite key is not included here
        const tableIndexes = table.indexes.filter((index) => !index.pk);
        indexes.push(...tableIndexes);
      }
    });

    return indexes;
  }

  static getCommentsFromSchema (schema) {
    const comments = [];

    schema.tables.forEach((table) => {
      table.fields.forEach((field) => {
        if (field.note) {
          comments.push({
            type: 'column',
            table,
            field,
          });
        }
      });
    });

    return comments;
  }

  static hasWhiteSpace (s) {
    return /\s/g.test(s);
  }
}

export default Exporter;
