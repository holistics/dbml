comment = _ COMMENT __ ON __ comment_option:comment_option __ IS __ text:(string_constant/NULL)
  _ semicolon _ {
  if (text.toLowerCase() !== "null") {
    comment_option.value.text = text;
  } else {
    comment_option.value.syntax_name = "remove_comment";
  }

  return {
    command_name: "comment",
    value: comment_option
  }
}

comment_option = (
  COLUMN __ relation_name:identifier "." column_name:column_name {
    return {
      syntax_name: "column",
      value: {
        relation_name: relation_name,
        column_name
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