import * as monaco from 'monaco-editor-core';
import Compiler, { ScopeKind } from '../../compiler';
import { SyntaxTokenKind } from '../../lib/lexer/tokens';
import { isOffsetWithinSpan } from '../../lib/utils';
import {
  CompletionList,
  TextModel,
  CompletionItemProvider,
  Position,
  CompletionItemKind,
  CompletionItemInsertTextRule,
} from '../types';
import { TableSymbol } from '../../lib/analyzer/symbol/symbols';
import { SymbolKind, destructureIndex } from '../../lib/analyzer/symbol/symbolIndex';
import {
  TokenLogicalLineIterator,
  TokenSourceIterator,
  isAtStartOfSimpleBody,
  isDot,
  pickCompletionItemKind,
  shouldAppendSpace,
  trimLeftMemberAccess,
  addQuoteIfContainSpace,
  noSuggestions,
  prependSpace,
} from './utils';
import { ElementDeclarationNode, ProgramNode } from '../../lib/parser/nodes';
import { ElementKind } from '../../lib/analyzer/validator/types';
import { getOffsetFromMonacoPosition } from '../utils';

/* eslint-disable @typescript-eslint/no-redeclare,no-import-assign */
const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages;
/* eslint-enable @typescript-eslint/no-redeclare,no-import-assign */

export default class DBMLCompletionItemProvider implements CompletionItemProvider {
  private compiler: Compiler;
  // alphabetic characters implictily invoke the autocompletion provider
  triggerCharacters = ['.', ':', ' ', '>', '<', '-'];

  constructor(compiler: Compiler) {
    this.compiler = compiler;
  }

  provideCompletionItems(model: TextModel, position: Position): CompletionList {
    const offset = getOffsetFromMonacoPosition(model, position);

    const beforeOrContainIter = TokenSourceIterator.fromOffset(this.compiler, offset);
    const beforeOrContainLineIter = TokenLogicalLineIterator.fromOffset(this.compiler, offset);
    const beforeOrContainToken = beforeOrContainIter.value().unwrap_or(undefined);

    // The token being currently modified
    // e.g: Table v1.a<trigger completion> -> `a` is being modified
    let editedIter: TokenSourceIterator | undefined;
    // The token before the token being edited,
    // if no token is being edited, it's the last token before or contain offset
    let preNonEditedIter: TokenSourceIterator | undefined;
    let preNonEditedLineIter: TokenLogicalLineIterator | undefined;
    if (!beforeOrContainToken) {
      return logicalLine.suggestTopLevel(this.compiler, model, offset, TokenLogicalLineIterator.fromOffset(this.compiler, -1));
    }

    if (isOffsetWithinSpan(offset, beforeOrContainToken)) {
      const containToken = beforeOrContainToken;
      switch (containToken.kind) {
        // We're editing a comment
        // No suggestions
        case SyntaxTokenKind.SINGLE_LINE_COMMENT:
        case SyntaxTokenKind.MULTILINE_COMMENT:
          return noSuggestions();
        // We're editing `containToken` in these cases
        case SyntaxTokenKind.IDENTIFIER:
        case SyntaxTokenKind.FUNCTION_EXPRESSION:
        case SyntaxTokenKind.COLOR_LITERAL:
        case SyntaxTokenKind.QUOTED_STRING:
        case SyntaxTokenKind.STRING_LITERAL:
        case SyntaxTokenKind.NUMERIC_LITERAL:
          editedIter = beforeOrContainIter;
          preNonEditedIter = beforeOrContainIter.back();
          preNonEditedLineIter = beforeOrContainLineIter.back();
          break;
        default:
          // All other cases, such as OP, COLON, parentheses
          // We do not consider that `containToken` is being edited
          editedIter = undefined;
          preNonEditedIter = beforeOrContainIter;
          preNonEditedLineIter = beforeOrContainLineIter;
          break;
      }
    } else {
      editedIter = undefined;
      preNonEditedIter = beforeOrContainIter;
      preNonEditedLineIter = beforeOrContainLineIter;
    }

    // Inspect the token before the being-edited token
    const preNonEditedToken = preNonEditedIter.value().unwrap_or(undefined);
    switch (preNonEditedToken?.kind) {
      case SyntaxTokenKind.OP:
        switch (preNonEditedToken.value) {
          case '.':
            // We're editing a token after '.',
            // which can mean that we're looking for a member
            return suggestMembers(this.compiler, model, offset, preNonEditedIter);
          case '<>':
          case '>':
          case '<':
          case '-':
            // We're editing a token after relationship operator
            return suggestOnRelOp(this.compiler, model, offset, preNonEditedIter);
          default:
            return noSuggestions();
        }
      case SyntaxTokenKind.LBRACKET:
        // We're editing an attribute name (after [)
        return suggestAttributeName(this.compiler, model, offset);
      case SyntaxTokenKind.COLON:
        return suggestOnColon(this.compiler, model, offset, preNonEditedIter);
      case SyntaxTokenKind.COMMA:
        return suggestOnComma(this.compiler, model, offset, preNonEditedIter);
      case SyntaxTokenKind.LPAREN:
        return suggestOnLParen(this.compiler, model, offset);
      default:
        break;
    }

    // We're editing a somewhat independent token
    // e.g id intege<trigger completion> <- editToken === 'integer' and lastToken === 'id'
    // We'll consider the whole logical line together
    return logicalLine.suggest(this.compiler, model, offset, preNonEditedLineIter);
  }
}

function suggestOnRelOp(
  compiler: Compiler,
  model: TextModel,
  offset: number,
  iterFromOp: TokenSourceIterator,
): CompletionList {
  const op = iterFromOp.value().unwrap();
  const ctx = compiler.context(offset).unwrap_or(undefined);
  if (!ctx || !ctx.scope || !ctx.element?.node) {
    return noSuggestions();
  }

  // Note: An incomplete relationship operation would corrupt the context
  // and `ctx` may fail to hold the precise scope, rather, it would holds the parent's scope
  // e.g
  // Table T {
  //  Ref: S.a > // at this point `ctx.scope` would be `Table`
  // }
  // Therefore, this check also checks for possible parent scopes
  // which would cover redundant cases, but otherwise complete
  if (
    ctx.scope.kind === ScopeKind.REF ||
    ctx.scope.kind === ScopeKind.TABLE ||
    ctx.scope.kind === ScopeKind.TOPLEVEL
  ) {
    const res = suggestNamesInScope(compiler, model, offset, ctx.element?.node, [
      SymbolKind.Table,
      SymbolKind.Schema,
      SymbolKind.Column,
    ]);

    return !shouldAppendSpace(op, offset) ? res : prependSpace(res);
  }

  return noSuggestions();
}

function suggestNamesInScope(
  compiler: Compiler,
  model: TextModel,
  offset: number,
  parent: ElementDeclarationNode | ProgramNode | undefined,
  acceptedKinds: SymbolKind[],
): CompletionList {
  if (parent === undefined) {
    return noSuggestions();
  }

  let curElement: ElementDeclarationNode | ProgramNode | undefined = parent;
  const res: CompletionList = { suggestions: [] };
  while (curElement) {
    if (curElement?.symbol?.symbolTable) {
      const { symbol } = curElement;
      res.suggestions.push(
        ...compiler.symbol
          .members(symbol)
          .filter(({ kind }) => acceptedKinds.includes(kind))
          .map(({ name, kind }) => ({
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: pickCompletionItemKind(kind),
            sortText: pickCompletionItemKind(kind).toString().padStart(2, '0'),
            range: undefined as any,
          })),
      );
    }
    curElement =
      curElement instanceof ElementDeclarationNode ? curElement.parentElement : undefined;
  }

  return addQuoteIfContainSpace(res);
}

function suggestColumnNameInIndexes(
  compiler: Compiler,
  model: TextModel,
  offset: number,
): CompletionList {
  const ctx = compiler.context(offset).unwrap_or(undefined);
  if (
    ctx?.element === undefined ||
    ctx?.scope?.kind !== ScopeKind.INDEXES ||
    ctx.element.node instanceof ProgramNode
  ) {
    return noSuggestions();
  }

  const indexesNode = ctx.element.node;
  const tableNode = indexesNode.parentElement;
  if (!(tableNode?.symbol instanceof TableSymbol)) {
    return noSuggestions();
  }

  const { symbolTable } = tableNode.symbol;

  return addQuoteIfContainSpace({
    suggestions: [...symbolTable.entries()].flatMap(([index]) => {
      const res = destructureIndex(index).unwrap_or(undefined);
      if (res === undefined) {
        return [];
      }
      const { name } = res;

      return {
        label: name,
        insertText: name,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: pickCompletionItemKind(SymbolKind.Column),
        range: undefined as any,
      };
    }),
  });
}

function suggestTopLevelTableNameInTableGroup(
  compiler: Compiler,
  model: TextModel,
  offset: number,
): CompletionList {
  const ctx = compiler.context(offset).unwrap_or(undefined);
  if (ctx?.element === undefined || ctx?.scope?.kind !== ScopeKind.TABLEGROUP) {
    return noSuggestions();
  }

  return addQuoteIfContainSpace({
    suggestions: [...compiler.parse.publicSymbolTable().entries()].flatMap(([index]) => {
      const res = destructureIndex(index).unwrap_or(undefined);
      if (res === undefined) {
        return [];
      }
      const { kind, name } = res;
      if (kind !== SymbolKind.Table && kind !== SymbolKind.Schema) {
        return [];
      }

      return {
        label: name,
        insertText: name,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: pickCompletionItemKind(kind),
        range: undefined as any,
      };
    }),
  });
}

function suggestOnComma(
  compiler: Compiler,
  model: TextModel,
  offset: number,
  iterFromComma: TokenSourceIterator,
): CompletionList {
  const comma = iterFromComma.value().unwrap();
  const ctx = compiler.context(offset).unwrap_or(undefined);
  if (ctx?.scope?.kind === undefined) {
    return noSuggestions();
  }

  if (ctx.subfield?.settingList || ctx.element?.settingList) {
    const res = suggestAttributeName(compiler, model, offset);

    return !shouldAppendSpace(comma, offset) ? res : prependSpace(res);
  }

  switch (ctx.scope.kind) {
    case ScopeKind.INDEXES:
      if (ctx.subfield?.callee) {
        return suggestColumnNameInIndexes(compiler, model, offset);
      }

      return noSuggestions();
    default:
      break;
  }

  return noSuggestions();
}

function suggestOnLParen(compiler: Compiler, model: TextModel, offset: number): CompletionList {
  const ctx = compiler.context(offset).unwrap_or(undefined);
  if (ctx?.scope?.kind === undefined) {
    return noSuggestions();
  }

  switch (ctx.scope.kind) {
    case ScopeKind.INDEXES:
      if (ctx.subfield?.callee) {
        return suggestColumnNameInIndexes(compiler, model, offset);
      }

      return noSuggestions();
    default:
      break;
  }

  return noSuggestions();
}

function suggestAttributeName(
  compiler: Compiler,
  model: TextModel,
  offset: number,
): CompletionList {
  const ctx = compiler.context(offset).unwrap_or(undefined);

  if (ctx?.element === undefined || ctx.scope === undefined) {
    return noSuggestions();
  }

  if (ctx.element && !ctx.subfield) {
    switch (ctx.scope.kind) {
      case ScopeKind.TABLE:
        return {
          suggestions: [
            {
              label: 'headercolor',
              insertText: 'headercolor: ',
              kind: CompletionItemKind.Field,
              insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
              range: undefined as any,
            },
            {
              label: 'note',
              insertText: 'note: ',
              kind: CompletionItemKind.Field,
              insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
              range: undefined as any,
            },
          ],
        };
      default:
        return noSuggestions();
    }
  }

  if (!ctx.subfield) {
    return noSuggestions();
  }

  switch (ctx.scope.kind) {
    case ScopeKind.TABLE:
      return {
        suggestions: [
          ...['primary key', 'null', 'not null', 'increment', 'pk', 'unique'].map((name) => ({
            label: name,
            insertText: name,
            kind: CompletionItemKind.Property,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          })),
          ...['ref', 'default'].map((name) => ({
            label: name,
            insertText: `${name}: `,
            kind: CompletionItemKind.Property,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          })),
          {
            label: 'note',
            insertText: 'note: ',
            kind: CompletionItemKind.Property,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          },
        ],
      };
    case ScopeKind.INDEXES:
      return {
        suggestions: [
          ...['unique', 'pk'].map((name) => ({
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: CompletionItemKind.Property,
            range: undefined as any,
          })),
          ...['note', 'name', 'type'].map((name) => ({
            label: name,
            insertText: `${name}: `,
            kind: CompletionItemKind.Property,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          })),
        ],
      };
    case ScopeKind.REF:
      return {
        suggestions: ['update', 'delete'].map((name) => ({
          label: name,
          insertText: `${name}: `,
          kind: CompletionItemKind.Property,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          range: undefined as any,
        })),
      };
    default:
      break;
  }

  return noSuggestions();
}

function suggestOnColon(
  compiler: Compiler,
  model: TextModel,
  offset: number,
  iterFromColon: TokenSourceIterator,
): CompletionList {
  const settingNameFragments: string[] = [];
  const colon = iterFromColon.value().unwrap();
  const ctx = compiler.context(offset).unwrap_or(undefined);

  if (ctx?.subfield?.settingList || ctx?.element?.settingList) {
    let iter = iterFromColon.back();
    while (!iter.isOutOfBound()) {
      const token = iter.value().unwrap_or(undefined);
      if (token?.kind !== SyntaxTokenKind.IDENTIFIER) {
        break;
      }
      settingNameFragments.push(token.value);
      iter = iter.back();
    }

    const res = suggestAttributeValue(compiler, model, offset, settingNameFragments.join(' '));

    return !shouldAppendSpace(colon, offset) ? res : prependSpace(res);
  }

  if (!ctx) {
    return noSuggestions();
  }

  const lineIter = TokenLogicalLineIterator.fromOffset(compiler, offset);
  // Note: An incomplete simple element declaration may corrupt the ElementDeclarationNode
  // and `ctx` may fail to hold the precise scope, rather, it would holds the parent's scope
  // e.g
  // Ref R: // At this point, the scope would be `TopLevel`
  // Therefore, this check also tries to inspect previous tokens (before :)
  if (ctx.scope?.kind === ScopeKind.REF || isAtStartOfSimpleBody(lineIter, ElementKind.REF)) {
    const res = suggestNamesInScope(compiler, model, offset, ctx.element?.node, [
      SymbolKind.Schema,
      SymbolKind.Table,
    ]);

    return !shouldAppendSpace(colon, offset) ? res : prependSpace(res);
  }

  return noSuggestions();
}

function suggestAttributeValue(
  compiler: Compiler,
  model: TextModel,
  offset: number,
  settingName: string,
): CompletionList {
  switch (settingName?.toLowerCase()) {
    case 'update':
    case 'delete':
      return {
        suggestions: ['cascade', 'set default', 'set null', 'restrict'].map((name) => ({
          label: name,
          insertText: name,
          kind: CompletionItemKind.Value,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          range: undefined as any,
        })),
      };
    case 'type':
      return {
        suggestions: ['btree', 'hash'].map((name) => ({
          label: name,
          insertText: `${name}`,
          kind: CompletionItemKind.Value,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          range: undefined as any,
        })),
      };
    default:
      break;
  }

  return noSuggestions();
}

function suggestMembers(
  compiler: Compiler,
  model: TextModel,
  offset: number,
  iterFromDot: TokenSourceIterator,
): CompletionList {
  const nameStack: string[] = [];
  let curIter = iterFromDot;
  let curToken = iterFromDot.value().unwrap_or(undefined);

  while (isDot(curToken)) {
    curIter = curIter.back();
    curToken = curIter.value().unwrap_or(undefined);
    if (
      curToken?.kind === SyntaxTokenKind.IDENTIFIER ||
      curToken?.kind === SyntaxTokenKind.QUOTED_STRING
    ) {
      nameStack.unshift(curToken.value);
    } else {
      return noSuggestions();
    }
    curIter = curIter.back();
    curToken = curIter.value().unwrap_or(undefined);
  }

  return {
    suggestions: compiler.membersOfName(nameStack).map(({ kind, name }) => ({
      label: name,
      insertText: name,
      kind: pickCompletionItemKind(kind),
      range: undefined as any,
    })),
  };
}

const logicalLine = {
  suggest(
    compiler: Compiler,
    model: TextModel,
    offset: number,
    preNonEditedLineIter: TokenLogicalLineIterator,
  ): CompletionList {
    const ctx = compiler.context(offset).unwrap_or(undefined);

    switch (ctx?.scope?.kind) {
      case ScopeKind.TABLE:
        return logicalLine.suggestInTable(compiler, model, offset, preNonEditedLineIter);
      case ScopeKind.TOPLEVEL:
        return logicalLine.suggestTopLevel(compiler, model, offset, preNonEditedLineIter);
      case ScopeKind.PROJECT:
        return logicalLine.suggestInProject(compiler, model, offset, preNonEditedLineIter);
      case ScopeKind.INDEXES:
        return logicalLine.suggestInIndexes(compiler, model, offset, preNonEditedLineIter);
      case ScopeKind.ENUM:
        return logicalLine.suggestInEnum(compiler, model, offset, preNonEditedLineIter);
      case ScopeKind.REF:
        return logicalLine.suggestInRef(compiler, model, offset, preNonEditedLineIter);
      case ScopeKind.TABLEGROUP:
        return logicalLine.suggestInTableGroup(compiler, model, offset, preNonEditedLineIter);
      default:
        return noSuggestions();
    }
  },

  suggestTopLevel(
    compiler: Compiler,
    model: TextModel,
    offset: number,
    preNonEditedLineIter: TokenLogicalLineIterator,
  ): CompletionList {
    const prevTokens = preNonEditedLineIter.collectFromStart().unwrap_or([]);
    const ctx = compiler.context(offset).unwrap_or(undefined);
    if (ctx && ctx.scope?.kind !== ScopeKind.TOPLEVEL) {
      return noSuggestions();
    }

    if (prevTokens.length === 0) {
      return {
        suggestions: ['Table', 'TableGroup', 'Enum', 'Project', 'Ref'].map((name) => ({
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.Keyword,
          range: undefined as any,
        })),
      };
    }

    return noSuggestions();
  },

  suggestInEnum(
    compiler: Compiler,
    model: TextModel,
    offset: number,
    preNonEditedLineIter: TokenLogicalLineIterator,
  ): CompletionList {
    const prevTokens = preNonEditedLineIter.collectFromStart().unwrap_or([]);
    const ctx = compiler.context(offset).unwrap_or(undefined);
    if (!ctx?.element?.body || ctx.scope?.kind !== ScopeKind.ENUM) {
      return noSuggestions();
    }

    if (prevTokens.length === 0) {
      return suggestNamesInScope(compiler, model, offset, ctx.element?.node, [
        SymbolKind.Schema,
        SymbolKind.Table,
        SymbolKind.Column,
      ]);
    }

    return noSuggestions();
  },

  suggestInTable(
    compiler: Compiler,
    model: TextModel,
    offset: number,
    preNonEditedLineIter: TokenLogicalLineIterator,
  ): CompletionList {
    const prevTokens = preNonEditedLineIter.collectFromStart().unwrap_or([]);
    const ctx = compiler.context(offset).unwrap_or(undefined);
    if (!ctx?.element?.body || ctx.scope?.kind !== ScopeKind.TABLE) {
      return noSuggestions();
    }

    if (prevTokens.length === 0) {
      return {
        suggestions: ['Ref', 'Note', 'indexes'].map((name) => ({
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.Keyword,
          range: undefined as any,
        })),
      };
    }

    let curLine = prevTokens;
    curLine = trimLeftMemberAccess(curLine).remaining;
    if (curLine.length === 0) {
      return logicalLine.suggestColumnType(compiler, model, offset);
    }

    return noSuggestions();
  },

  suggestInProject(
    compiler: Compiler,
    model: TextModel,
    offset: number,
    preNonEditedLineIter: TokenLogicalLineIterator,
  ): CompletionList {
    const prevTokens = preNonEditedLineIter.collectFromStart().unwrap_or([]);
    const ctx = compiler.context(offset).unwrap_or(undefined);
    if (!ctx?.element?.body || ctx.scope?.kind !== ScopeKind.PROJECT) {
      return noSuggestions();
    }

    if (prevTokens.length === 0) {
      return {
        suggestions: ['Table', 'TableGroup', 'Enum', 'Note', 'Ref'].map((name) => ({
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.Keyword,
          range: undefined as any,
        })),
      };
    }

    return noSuggestions();
  },

  suggestInRef(
    compiler: Compiler,
    model: TextModel,
    offset: number,
    preNonEditedLineIter: TokenLogicalLineIterator,
  ): CompletionList {
    const prevTokens = preNonEditedLineIter.collectFromStart().unwrap_or([]);
    const ctx = compiler.context(offset).unwrap_or(undefined);
    if (!ctx?.element?.body || ctx.scope?.kind !== ScopeKind.REF) {
      return noSuggestions();
    }

    if (prevTokens.length === 0) {
      return suggestNamesInScope(compiler, model, offset, ctx.element?.node, [
        SymbolKind.Schema,
        SymbolKind.Table,
        SymbolKind.Column,
      ]);
    }

    return noSuggestions();
  },

  suggestInTableGroup(
    compiler: Compiler,
    model: TextModel,
    offset: number,
    preNonEditedLineIter: TokenLogicalLineIterator,
  ): CompletionList {
    const prevTokens = preNonEditedLineIter.collectFromStart().unwrap_or([]);
    const ctx = compiler.context(offset).unwrap_or(undefined);
    if (!ctx?.element?.body || ctx.scope?.kind !== ScopeKind.TABLEGROUP) {
      return noSuggestions();
    }

    if (prevTokens.length === 0) {
      return suggestTopLevelTableNameInTableGroup(compiler, model, offset);
    }

    return noSuggestions();
  },

  suggestInIndexes(
    compiler: Compiler,
    model: TextModel,
    offset: number,
    preNonEditedLineIter: TokenLogicalLineIterator,
  ): CompletionList {
    const prevTokens = preNonEditedLineIter.collectFromStart().unwrap_or([]);
    const ctx = compiler.context(offset).unwrap_or(undefined);
    if (!ctx?.element?.body || ctx.scope?.kind !== ScopeKind.INDEXES) {
      return noSuggestions();
    }

    if (prevTokens.length === 0) {
      return suggestColumnNameInIndexes(compiler, model, offset);
    }

    return noSuggestions();
  },

  suggestColumnType(compiler: Compiler, model: TextModel, offset: number): CompletionList {
    const ctx = compiler.context(offset).unwrap_or(undefined);

    return {
      suggestions: [
        ...[
          'integer',
          'int',
          'tinyint',
          'smallint',
          'mediumint',
          'bigint',
          'bit',
          'bool',
          'binary',
          'varbinary',
          'logical',
          'char',
          'nchar',
          'varchar',
          'varchar2',
          'nvarchar',
          'nvarchar2',
          'binary_float',
          'binary_double',
          'float',
          'double',
          'decimal',
          'dec',
          'real',
          'money',
          'smallmoney',
          'enum',
          'tinyblob',
          'tinytext',
          'blob',
          'text',
          'mediumblob',
          'mediumtext',
          'longblob',
          'longtext',
          'ntext',
          'set',
          'inet6',
          'uuid',
          'image',
          'date',
          'time',
          'datetime',
          'datetime2',
          'timestamp',
          'year',
          'smalldatetime',
          'datetimeoffset',
          'XML',
          'sql_variant',
          'uniqueidentifier',
          'CURSOR',
          'BFILE',
          'CLOB',
          'NCLOB',
          'RAW',
        ].map((name) => ({
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.TypeParameter,
          sortText: CompletionItemKind.TypeParameter.toString().padStart(2, '0'),
          range: undefined as any,
        })),
        ...suggestNamesInScope(compiler, model, offset, ctx?.element?.node, [
          SymbolKind.Enum,
          SymbolKind.Schema,
        ]).suggestions,
      ],
    };
  },
};
