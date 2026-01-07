// Query identifiers for cache keys
export const enum QueryId {
  _Interpret = '_Interpret',
  Parse_Ast = 'Parse_Ast',
  Parse_Errors = 'Parse_Errors',
  Parse_RawDb = 'Parse_RawDb',
  Parse_Tokens = 'Parse_Tokens',
  Parse_PublicSymbolTable = 'Parse_PublicSymbolTable',
  Token_InvalidStream = 'Token_InvalidStream',
  Token_FlatStream = 'Token_FlatStream',
  Symbol_OfName = 'Symbol_OfName',
  Symbol_Members = 'Symbol_Members',
  Container_Stack = 'Container_Stack',
  Container_Token = 'Container_Token',
  Container_Element = 'Container_Element',
  Container_Scope = 'Container_Scope',
  Container_Scope_Kind = 'Container_Scope_Kind',
}

export const enum ScopeKind {
  TABLE,
  ENUM,
  TABLEGROUP,
  INDEXES,
  NOTE,
  REF,
  PROJECT,
  CUSTOM,
  TOPLEVEL,
  TABLEPARTIAL,
  CHECKS,
}
