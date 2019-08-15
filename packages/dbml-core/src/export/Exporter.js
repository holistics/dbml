import _ from 'lodash';

class Exporter {
  constructor (schema = {}) {
    this.schema = schema;
  }

  static getIndexesFromSchema (schema) {
    const indexes = [];

    schema.tables.forEach((table) => {
      if (!_.isEmpty(table.indexes)) {
        indexes.push(...table.indexes);
      }
    });

    return indexes;
  }

  static hasWhiteSpace (s) {
    return /\s/g.test(s);
  }
}

export default Exporter;
