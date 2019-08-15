ignore_syntax = _ value:(
  INSERT [^;]* { return { syntax_name: "insert" } }
  / SET [^;]* { return { syntax_name: "set" } }
  / RESET [^;]* { return { syntax_name: "reset" } }
  / SELECT [^;]* { return { syntax_name: "select" } }
  / DROP [^;]* { return { syntax_name: "drop" } }
  / USE [^;]* { return { syntax_name: "use" } }
  / CREATE __ SEQUENCE [^;]* { return { syntax_name: "create_sequence" } }
  / CREATE __ SCHEMA [^;]* { return { syntax_name: "create_schema" } }
  / CREATE __ VIEW [^;]* { return { syntax_name: "create_view" } }
  / __ { return { syntax_name: "comment_and_space" } }
) semicolon _ {
  return {
    command_name: "ignore_syntax",
    value
  }
}