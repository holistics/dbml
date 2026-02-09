{
  // intput:
  // `
  //      'created'
  //                   ,
  //         'pending',          'done'
  //  `
  //  => `'created', 'pending', 'done'`
  const removeReduntdantSpNewline = (str) => {
    const arr = str.split(/[\s\r\n]*,[\s\r\n]*/);
    // need to trim spaces and newlines of the first and last element
    const arrAfterTrim = arr.map(ele => {
      return ele.replace(/^[\s]+|[\s]+$|[\r\n]|\s(?=\s)/g, '');
    });
    return arrAfterTrim.join(', ');
  }

  // TODO: support configurable default schema name other than 'public'
  const findTable = (schemaName, tableName) => {
    const realSchemaName = schemaName || 'public';
    const table = tables.find(table => {
      const targetSchemaName = table.schemaName || 'public';
      return targetSchemaName === realSchemaName && table.name === tableName;
    });
    return table;
  };

  const findField = (table, fieldName) => table.fields.find(field => field.name === fieldName);
}