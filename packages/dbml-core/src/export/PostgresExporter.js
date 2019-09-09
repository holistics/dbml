import _ from 'lodash';
import Exporter from './Exporter';

class PostgresExporter extends Exporter {
  constructor (schema = {}) {
    super(schema);
    this.indexes = Exporter.getIndexesFromSchema(schema);
    this.comments = Exporter.getCommentsFromSchema(schema);
  }

  exportEnums () {
    const enumArr = this.schema.enums.map((_enum) => {
      const enumValueArr = _enum.values.map((value) => {
        return `  '${value.name}'`;
      });
      const enumValueStr = enumValueArr.join(',\n');

      const line = `CREATE TYPE "${_enum.name}" AS ENUM (\n${enumValueStr}\n);\n`;
      return line;
    });

    return enumArr.length ? enumArr.join('\n') : '';
  }

  static getFieldLines (table) {
    const lines = table.fields.map((field) => {
      let line = '';
      if (field.increment) {
        line = `"${field.name}" SERIAL`;
      } else if (Exporter.hasWhiteSpace(field.type.type_name)) {
        line = `"${field.name}" "${field.type.type_name}"`;
      } else {
        line = `"${field.name}" ${field.type.type_name}`;
      }

      if (field.unique) {
        line += ' UNIQUE';
      }
      if (field.pk) {
        line += ' PRIMARY KEY';
      }
      if (field.not_null) {
        line += ' NOT NULL';
      }
      if (field.dbdefault) {
        if (field.dbdefault.type === 'expression') {
          line += ` DEFAULT (${field.dbdefault.value})`;
        } else if (field.dbdefault.type === 'string') {
          line += ` DEFAULT '${field.dbdefault.value}'`;
        } else {
          line += ` DEFAULT ${field.dbdefault.value}`;
        }
      }

      return line;
    });

    return lines;
  }

  static getPrimaryCompositeKey (table) {
    const primaryCompositeKey = table.indexes ? table.indexes.filter(index => index.pk) : [];
    const lines = primaryCompositeKey.map((key) => {
      let line = 'PRIMARY KEY';
      const columnArr = [];
      key.columns.forEach((column) => {
        let columnStr = '';
        if (column.type === 'expression') {
          columnStr = `(${column.value})`;
        } else {
          columnStr = `"${column.value}"`;
        }
        columnArr.push(columnStr);
      });

      line += ` (${columnArr.join(', ')})`;

      return line;
    });

    return lines;
  }

  getTableContentArr () {
    const tableContentArr = this.schema.tables.map((table) => {
      const { name } = table;
      const fieldContents = PostgresExporter.getFieldLines(table);
      const primaryCompositeKey = PostgresExporter.getPrimaryCompositeKey(table);

      return {
        name,
        fieldContents,
        primaryCompositeKey,
      };
    });

    return tableContentArr;
  }

  exportTables () {
    const tableContentArr = this.getTableContentArr();

    const tableStrs = tableContentArr.map((table) => {
      const content = [...table.fieldContents, ...table.primaryCompositeKey];
      /* eslint-disable indent */
      const tableStr = `CREATE TABLE "${table.name}" (\n${
        content.map(line => `  ${line}`).join(',\n')
        }\n);\n`;
      /* eslint-enable indent */
      return tableStr;
    });

    return tableStrs.length ? tableStrs.join('\n') : '';
  }

  exportRefs () {
    const validRefs = this.schema.refs.filter((ref) => (
      ref.endpoints.every(endpoint => {
        return this.schema.tables.find((table) => table.name === endpoint.tableName);
      })
    ));

    const strArr = validRefs.map((ref) => {
      const refEndpointIndex = ref.endpoints.findIndex(endpoint => endpoint.relation === '1');
      const foreignEndpoint = ref.endpoints[1 - refEndpointIndex];
      const refEndpoint = ref.endpoints[refEndpointIndex];

      let line = `ALTER TABLE "${foreignEndpoint.tableName}" ADD `;
      if (ref.name) { line += `CONSTRAINT "${ref.name}" `; }
      line += `FOREIGN KEY ("${foreignEndpoint.fieldName}") REFERENCES "${refEndpoint.tableName}" ("${refEndpoint.fieldName}")`;
      if (ref.onDelete) {
        line += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
      }
      if (ref.onUpdate) {
        line += ` ON UPDATE ${ref.onUpdate.toUpperCase()}`;
      }
      line += ';\n';

      return line;
    });

    return strArr.length ? strArr.join('\n') : '';
  }

  exportIndexes () {
    const indexArr = this.indexes.map((index) => {
      let line = 'CREATE';
      if (index.unique) {
        line += ' UNIQUE';
      }
      const indexName = index.name ? `"${index.name}"` : '';
      line += ' INDEX';
      if (indexName) {
        line += ` ${indexName}`;
      }
      line += ` ON "${index.table.name}"`;
      if (index.type) {
        line += ` USING ${index.type.toUpperCase()}`;
      }

      const columnArr = [];
      index.columns.forEach((column) => {
        let columnStr = '';
        if (column.type === 'expression') {
          columnStr = `(${column.value})`;
        } else {
          columnStr = `"${column.value}"`;
        }
        columnArr.push(columnStr);
      });

      line += ` (${columnArr.join(', ')})`;
      line += ';\n';

      return line;
    });

    return indexArr.length ? indexArr.join('\n') : '';
  }

  exportComments () {
    const commentArr = this.comments.map((comment) => {
      let line = 'COMMENT ON';

      if (comment.type === 'column') {
        line += ` COLUMN "${comment.table.name}"."${comment.field.name}" IS '${comment.field.note}'`;
      }

      line += ';\n';

      return line;
    });

    return commentArr.length ? commentArr.join('\n') : '';
  }

  export () {
    let res = '';
    let hasBlockAbove = false;

    if (!_.isEmpty(this.schema.enums)) {
      res += this.exportEnums();
      hasBlockAbove = true;
    }

    if (!_.isEmpty(this.schema.tables)) {
      if (hasBlockAbove) res += '\n';
      res += this.exportTables();
      hasBlockAbove = true;
    }

    if (!_.isEmpty(this.schema.refs)) {
      if (hasBlockAbove) res += '\n';
      res += this.exportRefs();
      hasBlockAbove = true;
    }

    if (!_.isEmpty(this.indexes)) {
      if (hasBlockAbove) res += '\n';
      res += this.exportIndexes();
      hasBlockAbove = true;
    }

    if (!_.isEmpty(this.comments)) {
      if (hasBlockAbove) res += '\n';
      res += this.exportComments();
      hasBlockAbove = true;
    }

    return res;
  }
}

export default PostgresExporter;
