import { SyntaxToken } from './lexer/tokens';
import { SyntaxNode } from './parser/nodes';

export enum CompileErrorCode {
  UNKNOWN_SYMBOL = 1000,

  UNEXPECTED_SYMBOL,
  UNEXPECTED_EOF,
  UNEXPECTED_NEWLINE,

  UNKNOWN_TOKEN,
  UNEXPECTED_TOKEN,
  MISPLACED_LIST_NODE,
  MISSING_SPACES,
  UNKNOWN_PREFIX_OP,
  INVALID_OPERAND,
  EMPTY_ATTRIBUTE_NAME,

  INVALID_NAME = 3000,
  UNEXPECTED_NAME,
  NAME_NOT_FOUND,
  DUPLICATE_NAME,
  INVALID_ALIAS,
  UNEXPECTED_ALIAS,
  UNEXPECTED_SETTINGS,
  INVALID_SETTINGS,
  UNEXPECTED_SIMPLE_BODY,
  UNEXPECTED_COMPLEX_BODY,

  INVALID_TABLE_CONTEXT,
  INVALID_TABLE_SETTING,
  DUPLICATE_TABLE_SETTING,

  INVALID_TABLEGROUP_CONTEXT,
  INVALID_TABLEGROUP_ELEMENT_NAME,
  DUPLICATE_TABLEGROUP_ELEMENT_NAME,
  INVALID_TABLEGROUP_FIELD,

  INVALID_COLUMN,
  INVALID_COLUMN_NAME,
  UNKNOWN_COLUMN_SETTING,
  INVALID_COLUMN_TYPE,
  DUPLICATE_COLUMN_NAME,
  DUPLICATE_COLUMN_SETTING,
  INVALID_COLUMN_SETTING_VALUE,

  INVALID_ENUM_CONTEXT,
  INVALID_ENUM_ELEMENT_NAME,
  INVALID_ENUM_ELEMENT,
  DUPLICATE_ENUM_ELEMENT_NAME,
  UNKNOWN_ENUM_ELEMENT_SETTING,
  DUPLICATE_ENUM_ELEMENT_SETTING,
  INVALID_ENUM_ELEMENT_SETTING,

  INVALID_REF_CONTEXT,
  UNKNOWN_REF_SETTING,
  DUPLICATE_REF_SETTING,
  INVALID_REF_SETTING_VALUE,
  INVALID_REF_RELATIONSHIP,
  INVALID_REF_FIELD,

  INVALID_NOTE_CONTEXT,
  INVALID_NOTE,
  NOTE_REDEFINED,

  INVALID_INDEXES_CONTEXT,
  INVALID_INDEXES_FIELD,
  INVALID_INDEX,
  UNKNOWN_INDEX_SETTING,
  DUPLICATE_INDEX_SETTING,
  UNEXPECTED_INDEX_SETTING_VALUE,
  INVALID_INDEX_SETTING_VALUE,

  INVALID_PROJECT_CONTEXT,
  PROJECT_REDEFINED,
  INVALID_PROJECT_FIELD,

  INVALID_CUSTOM_CONTEXT,
  INVALID_CUSTOM_ELEMENT_VALUE,

  BINDING_ERROR = 4000,
}

export class CompileError extends Error {
  code: Readonly<CompileErrorCode>;

  diagnostic: Readonly<string>;

  nodeOrToken: Readonly<SyntaxNode | SyntaxToken>; // The node or token that causes the error

  start: Readonly<number>;

  end: Readonly<number>;

  constructor(code: number, message: string, nodeOrToken: SyntaxNode | SyntaxToken) {
    super(message);
    this.code = code;
    this.diagnostic = message;
    this.nodeOrToken = nodeOrToken;
    this.start = nodeOrToken.start;
    this.end = nodeOrToken.end;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, CompileError.prototype);
  }

  isTokenError(): this is CompileError & { nodeOrToken: SyntaxToken } {
    return this.nodeOrToken instanceof SyntaxToken;
  }

  isNodeError(): this is CompileError & { nodeOrToken: SyntaxNode } {
    return !(this.nodeOrToken instanceof SyntaxToken);
  }
}
