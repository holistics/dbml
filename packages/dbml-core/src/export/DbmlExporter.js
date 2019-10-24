import _ from 'lodash';

class DbmlExporter {
  constructor (schema = {}) {
    this.schema = schema;
  }

  static hasWhiteSpace (str) {
    return /\s/g.test(str);
  }

  static isExpression (str) {
    return /\s*(\*|\+|-|\([A-Za-z0-9_]+\)|\(\))/g.test(str);
  }

  exportEnums () {
    const enumStrs = this.schema.enums.map(_enum => (
      /* eslint-disable indent */
      `Enum ${`"${_enum.name}"`} {\n${
      _enum.values.map(value => `  "${value.name}"${value.note ? ` [note: '${value.note}']` : ''}`).join('\n')
      }\n}\n`
      /* eslint-enable indent */
    ));

    return enumStrs.length ? enumStrs.join('\n') : '';
  }

  static getFieldLines (table) {
    const lines = table.fields.map((field) => {
      /* eslint-disable indent */
      let line = `"${field.name}" ${DbmlExporter.hasWhiteSpace(field.type.type_name)
        ? `"${field.type.type_name}"` : field.type.type_name}`;
      /* eslint-enable indent */

      const constraints = [];
      if (field.unique) {
        constraints.push('unique');
      }
      if (field.pk) {
        constraints.push('pk');
      }
      if (field.not_null) {
        constraints.push('not null');
      }
      if (field.increment) {
        constraints.push('increment');
      }
      if (field.dbdefault) {
        let value = 'default: ';
        switch (field.dbdefault.type) {
          case 'boolean':
          case 'number':
            value += `${field.dbdefault.value}`;
            break;

          case 'string':
            value += `"${field.dbdefault.value}"`;
            break;

          case 'expression':
            value += `\`${field.dbdefault.value}\``;
            break;

          default:
            break;
        }
        constraints.push(value);
      }
      if (field.note) {
        constraints.push(`note: '${field.note}'`);
      }

      if (constraints.length > 0) {
        line += ` [${constraints.join(', ')}]`;
      }
      return line;
    });

    return lines;
  }

  static getIndexLines (table) {
    const lines = table.indexes.map((index) => {
      let line = '';

      if (index.columns.length > 1) {
        line = `(${index.columns.map((column) => {
          if (column.type === 'expression') {
            return `\`${column.value}\``;
          }
          return column.value;
        }).join(', ')})`;
      } else if (index.columns.length === 1) {
        line = index.columns[0].type === 'expression'
          ? `\`${index.columns[0].value}\`` : index.columns[0].value;
      }

      const indexSettings = [];
      if (index.pk) {
        indexSettings.push('pk');
      }
      if (index.type) {
        indexSettings.push(`type: ${index.type.toLowerCase()}`);
      }
      if (index.unique) {
        indexSettings.push('unique');
      }
      if (index.name) {
        indexSettings.push(`name: "${index.name}"`);
      }

      if (indexSettings.length > 1) {
        line += ` [${indexSettings.join(', ')}]`;
      } else if (indexSettings.length === 1) {
        line += ` [${indexSettings[0]}]`;
      }
      return line;
    });

    return lines;
  }

  getTableContentArr () {
    const tableContentArr = this.schema.tables.map((table) => {
      const { name } = table;

      const fieldContents = DbmlExporter.getFieldLines(table);
      const indexContents = DbmlExporter.getIndexLines(table);

      return {
        name,
        fieldContents,
        indexContents,
      };
    });

    return tableContentArr;
  }

  exportTables () {
    const tableContentArr = this.getTableContentArr();

    const tableStrs = tableContentArr.map((table) => {
      let indexStr = '';
      if (!_.isEmpty(table.indexContents)) {
        /* eslint-disable indent */
        indexStr = `
        \nIndexes {\n${table.indexContents.map(indexLine => `  ${indexLine}`).join('\n')}\n}`;
        /* eslint-enable indent */
      }

      /* eslint-disable indent */
      const tableStr = `Table "${table.name}" {\n${
        table.fieldContents.map(line => `  ${line}`).join('\n') // format with tab
        }\n${indexStr ? `${indexStr}\n` : ''}}\n`;
      /* eslint-enable indent */

      return tableStr;
    });

    return tableStrs.length ? tableStrs.join('\n') : '';
  }

  exportRefs () {
    const validRefs = this.schema.refs.filter((ref) => {
      return ref.endpoints.every((endpoint) => {
        return this.schema.tables.find((table) => table.name === endpoint.tableName);
      });
    });

    const strArr = validRefs.map((ref) => {
      const refEndpointIndex = ref.endpoints.findIndex(endpoint => endpoint.relation === '1');
      const foreignEndpoint = ref.endpoints[1 - refEndpointIndex];
      const refEndpoint = ref.endpoints[refEndpointIndex];

      let line = 'Ref';
      if (ref.name) { line += ` "${ref.name}"`; }
      line += ':';
      line += `"${refEndpoint.tableName}"."${refEndpoint.fieldName}" `;
      if (foreignEndpoint === '1') line += '- ';
      else line += '< ';
      line += `"${foreignEndpoint.tableName}"."${foreignEndpoint.fieldName}"\n`;

      return line;
    });

    return strArr.length ? strArr.join('\n') : '';
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

    return res;
  }
}

export default DbmlExporter;
