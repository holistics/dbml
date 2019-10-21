import _ from 'lodash';
import Exporter from './Exporter';

class SqlServerExporter extends Exporter {
  constructor (schema = {}) {
    super(schema);
    this.indexes = Exporter.getIndexesFromSchema(schema);
  }

  static getFieldLines (table) {
    const lines = table.fields.map((field) => {
      let line = '';
      if (field.enumRef) {
        line = `[${field.name}] nvarchar(255) NOT NULL CHECK ([${field.name}] IN (`;
        const enumValues = field.enumRef.values.map(value => {
          return `'${value.name}'`;
        });
        line += `${enumValues.join(', ')}))`;
      } else {
        line = `[${field.name}] ${field.type.type_name !== 'varchar' ? field.type.type_name : 'nvarchar(255)'}`;
        line = line.replace(/boolean/gi, 'BIT'); // SQL Server does not have type BOOLEAN
        // line = line.replace(/char|varchar|nvarchar/gi, '[$&]');
      }

      if (field.unique) {
        line += ' UNIQUE';
      }
      if (field.pk) {
        line += ' PRIMARY KEY';
      }
      if (!field.enumRef && field.not_null) {
        line += ' NOT NULL';
      }
      if (field.increment) {
        line += ' IDENTITY(1, 1)';
      }
      if (field.dbdefault) {
        if (field.type.type_name.match(/boolean/gi)) {
          // SQL Server does not have type BOOLEAN so we change it to BIT
          if (field.dbdefault.value.match(/true/gi)) {
            line += ' DEFAULT 1';
          } else {
            line += ' DEFAULT 0';
          }
        } else if (field.dbdefault.type === 'expression') {
          line += ` DEFAULT (${field.dbdefault.value})`;
        } else if (field.dbdefault.type === 'string') {
          line += ` DEFAULT '${field.dbdefault.value}'`;
        } else {
          line += ` DEFAULT (${field.dbdefault.value})`;
        }
        line = line.replace(/now/gi, 'GETDATE');
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
          columnStr = `[${column.value}]`;
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
      const fieldContents = SqlServerExporter.getFieldLines(table);
      const primaryCompositeKey = SqlServerExporter.getPrimaryCompositeKey(table);

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
      const tableStr = `CREATE TABLE [${table.name}] (\n${
        content.map(line => `  ${line}`).join(',\n') // format with tab
        }\n)\nGO\n`;
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

      let line = `ALTER TABLE [${foreignEndpoint.tableName}] ADD `;
      if (ref.name) { line += `CONSTRAINT [${ref.name}] `; }
      line += `FOREIGN KEY ([${foreignEndpoint.fieldName}]) REFERENCES [${refEndpoint.tableName}] ([${refEndpoint.fieldName}])`;
      line += '\nGO\n';

      return line;
    });

    return strArr.length ? strArr.join('\n') : '';
  }

  exportIndexes () {
    const indexArr = this.indexes.map((index, i) => {
      let line = 'CREATE';
      if (index.unique) {
        line += ' UNIQUE';
      }
      const indexName = index.name ? `[${index.name}]` : `[${index.table.name}_index_${i}]`;
      line += ` INDEX ${indexName} ON [${index.table.name}]`;

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
      line += '\nGO\n';

      return line;
    });

    return indexArr.length ? indexArr.join('\n') : '';
  }

  export () {
    let res = '';
    let hasBlockAbove = false;
    if (!_.isEmpty(this.schema.tables)) {
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

    return res;
  }
}

export default SqlServerExporter;
