comment = _ COMMENT __ ON __ comment_option:comment_option __ IS __ text:(string_constant/NULL)
  _ semicolon _ {
  if (text.toLowerCase() !== "null") {
    comment_option.value.text = text;
  } else comment_option.value.text = null;

  return {
    command_name: "comment",
    value: comment_option
  }
}

comment_option = (
  COLUMN __ path:(identifier '.')+ column_name:column_name {
    let dbName = null, schemaName = null, tableName;
    if (path.length === 1) {
      tableName = path[0][0];
    } else if (path.length === 2) {
      schemaName = path[0][0];
      tableName = path[1][0];
    }
    else {
      dbName = path[0][0];
      schemaName = path[1][0];
      tableName = path[2][0];
    }
    return {
      syntax_name: "column",
      value: {
        dbName,
        schemaName,
        tableName,
        columnName: column_name
      }
    }
  }
  / TABLE __ object_name:table_name {
    return {
      syntax_name: "table",
      value: {
        table_name: object_name
      }
    }
  }
)