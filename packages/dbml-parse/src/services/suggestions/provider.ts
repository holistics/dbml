import {
  destructureMemberAccessExpression,
  extractVariableFromExpression,
  getElementKind,
  destructureCallExpression,
} from '@/core/analyzer/utils';
import {
  extractStringFromIdentifierStream,
  isExpressionAVariableNode,
} from '@/core/parser/utils';
import Compiler, { ScopeKind } from '@/compiler';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { isOffsetWithinSpan } from '@/core/utils';
import {
  type CompletionList,
  type TextModel,
  type CompletionItemProvider,
  type Position,
  CompletionItemKind,
  CompletionItemInsertTextRule,
} from '@/services/types';
import { TableSymbol, type NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { SymbolKind, destructureIndex } from '@/core/analyzer/symbol/symbolIndex';
import {
  pickCompletionItemKind,
  shouldPrependSpace,
  addQuoteIfNeeded,
  noSuggestions,
  prependSpace,
  isOffsetWithinElementHeader,
  excludeSuggestions,
  addExpandAllColumnsSuggestion,
  isTupleEmpty,
} from '@/services/suggestions/utils';
import {
  AttributeNode,
  CallExpressionNode,
  CommaExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  PrefixExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
} from '@/core/parser/nodes';
import { getOffsetFromMonacoPosition } from '@/services/utils';
import { isComment } from '@/core/lexer/utils';
import { ElementKind, SettingName } from '@/core/analyzer/types';
import { last } from 'lodash-es';

export default class DBMLCompletionItemProvider implements CompletionItemProvider {
  private compiler: Compiler;

  triggerCharacters: string[];

  constructor (compiler: Compiler, triggerCharacters: string[] = []) {
    this.compiler = compiler;
    this.triggerCharacters = triggerCharacters;
  }

  provideCompletionItems (model: TextModel, position: Position): CompletionList {
    const offset = getOffsetFromMonacoPosition(model, position);
    const flatStream = this.compiler.token.flatStream();
    // bOc: before-or-contain
    const { token: bOcToken, index: bOcTokenId } = this.compiler.container.token(offset);
    // abOc: after before-or-contain
    const abOcToken = bOcTokenId === undefined ? flatStream[0] : flatStream[bOcTokenId + 1];

    // Check if we're inside a comment
    if (
      [
        ...(bOcToken?.trailingTrivia || []),
        ...(bOcToken?.leadingTrivia || []),
        ...(abOcToken?.leadingTrivia || []),
      ].find((token) => isComment(token) && isOffsetWithinSpan(offset, token))
    ) {
      return noSuggestions();
    }

    if (bOcTokenId === undefined) {
      return suggestTopLevelElementType();
    }

    // Check if we're inside a string
    if ([SyntaxTokenKind.STRING_LITERAL, SyntaxTokenKind.QUOTED_STRING].includes(bOcToken.kind) && isOffsetWithinSpan(offset, bOcToken)) {
      return noSuggestions();
    }

    const element = this.compiler.container.element(offset);
    if (
      this.compiler.container.scopeKind(offset) === ScopeKind.TOPLEVEL
      || (element instanceof ElementDeclarationNode
        && element.type
        && element.type.start <= offset
        && element.type.end >= offset)
    ) {
      return suggestTopLevelElementType();
    }

    const containers = [...this.compiler.container.stack(offset)].reverse();

    for (const container of containers) {
      if (container instanceof PrefixExpressionNode) {
        switch (container.op?.value) {
          case '>':
          case '<':
          case '<>':
          case '-':
            return suggestOnRelOp(
              this.compiler,
              offset,
              container as PrefixExpressionNode & { op: SyntaxToken },
            );
          case '~':
            return suggestOnPartialInjectionOp(
              this.compiler,
              offset,
            );
          default:
        }
      } else if (container instanceof InfixExpressionNode) {
        switch (container.op?.value) {
          case '>':
          case '<':
          case '<>':
          case '-':
            return suggestOnRelOp(
              this.compiler,
              offset,
              container as InfixExpressionNode & { op: SyntaxToken },
            );
          case '.':
            return suggestMembers(
              this.compiler,
              offset,
              container as InfixExpressionNode & { op: SyntaxToken },
            );
          default:
        }
      } else if (container instanceof AttributeNode) {
        return suggestInAttribute(this.compiler, offset, container);
      } else if (container instanceof ListExpressionNode) {
        return suggestInAttribute(this.compiler, offset, container);
      } else if (container instanceof TupleExpressionNode) {
        return suggestInTuple(this.compiler, offset, container);
      } else if (container instanceof CommaExpressionNode) {
        return suggestInCommaExpression(this.compiler, offset);
      } else if (container instanceof CallExpressionNode) {
        return suggestInCallExpression(this.compiler, offset, container);
      } else if (container instanceof FunctionApplicationNode) {
        return suggestInSubField(this.compiler, offset, container);
      } else if (container instanceof ElementDeclarationNode) {
        // Check if we're in a Records element header - suggest schema.table names
        if (
          getElementKind(container).unwrap_or(undefined) === ElementKind.Records
          && isOffsetWithinElementHeader(offset, container)
        ) {
          return suggestInRecordsHeader(this.compiler, offset, container);
        }


        if (
          (container.bodyColon && offset >= container.bodyColon.end)
          || (container.body && isOffsetWithinSpan(offset, container.body))
        ) {
          return suggestInSubField(this.compiler, offset, undefined);
        }
      }
    }

    return noSuggestions();
  }
}

function suggestOnPartialInjectionOp (
  compiler: Compiler,
  offset: number,
) {
  return suggestNamesInScope(compiler, offset, compiler.parse.ast(), [SymbolKind.TablePartial]);
}

function suggestOnRelOp (
  compiler: Compiler,
  offset: number,
  container: (PrefixExpressionNode | InfixExpressionNode) & { op: SyntaxToken },
): CompletionList {
  const scopeKind = compiler.container.scopeKind(offset);

  if ([
    ScopeKind.REF,
    ScopeKind.TABLE,
    ScopeKind.TABLEPARTIAL,
  ].includes(scopeKind)) {
    const res = suggestNamesInScope(compiler, offset, compiler.container.element(offset), [
      SymbolKind.Table,
      SymbolKind.Schema,
      SymbolKind.Column,
    ]);

    return !shouldPrependSpace(container.op, offset) ? res : prependSpace(res);
  }

  return noSuggestions();
}

function suggestMembersOfSymbol (
  compiler: Compiler,
  symbol: NodeSymbol,
  acceptedKinds: SymbolKind[],
): CompletionList {
  return addQuoteIfNeeded({
    suggestions: compiler.symbol
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
  });
}

function suggestNamesInScope (
  compiler: Compiler,
  offset: number,
  parent: ElementDeclarationNode | ProgramNode | undefined,
  acceptedKinds: SymbolKind[],
): CompletionList {
  if (parent === undefined) {
    return noSuggestions();
  }

  let curElement: SyntaxNode | undefined = parent;
  const res: CompletionList = { suggestions: [] };
  while (curElement) {
    if (curElement?.symbol?.symbolTable) {
      const { symbol } = curElement;
      res.suggestions.push(
        ...suggestMembersOfSymbol(compiler, symbol, acceptedKinds).suggestions,
      );
    }
    curElement = curElement instanceof ElementDeclarationNode ? curElement.parent : undefined;
  }

  return addQuoteIfNeeded(res);
}

function suggestInTuple (compiler: Compiler, offset: number, tupleContainer: TupleExpressionNode): CompletionList {
  const scopeKind = compiler.container.scopeKind(offset);
  const element = compiler.container.element(offset);

  // Check if we're inside a CallExpression - delegate to suggestInCallExpression
  const containers = [...compiler.container.stack(offset)];
  for (const c of containers) {
    if (c instanceof CallExpressionNode && c.argumentList === tupleContainer) {
      return suggestInCallExpression(compiler, offset, c);
    }
  }

  // Check if we're in a Records element header
  if (
    element instanceof ElementDeclarationNode
    && getElementKind(element).unwrap_or(undefined) === ElementKind.Records
    && !(element.name instanceof CallExpressionNode)
    && isOffsetWithinElementHeader(offset, element)
  ) {
    const tableSymbol = element.parent?.symbol || element.name?.referee;
    if (tableSymbol) {
      let suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [SymbolKind.Column]);
      // If the user already typed some columns, we do not suggest "all columns" anymore
      if (!isTupleEmpty(tupleContainer)) return suggestions;
      suggestions = excludeSuggestions(suggestions, ['records']);
      suggestions = addExpandAllColumnsSuggestion(suggestions);
      return suggestions;
    }
  }

  switch (scopeKind) {
    case ScopeKind.TABLE: {
      // Check if we're inside a table typing "Records (...)"
      // In this case, Records is a FunctionApplicationNode
      for (const c of containers) {
        if (
          c instanceof FunctionApplicationNode
          && isExpressionAVariableNode(c.callee)
          && extractVariableFromExpression(c.callee).unwrap_or('').toLowerCase() === 'records'
          && !(c.args?.[0] instanceof CallExpressionNode)
        ) {
          const tableSymbol = element.symbol;
          if (tableSymbol) {
            let suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [SymbolKind.Column]);
            // If the user already typed some columns, we do not suggest "all columns" anymore
            if (!isTupleEmpty(tupleContainer)) return suggestions;
            suggestions = excludeSuggestions(suggestions, ['records']);
            suggestions = addExpandAllColumnsSuggestion(suggestions);
            return suggestions;
          }
          break;
        }
      }
      break;
    }
    case ScopeKind.INDEXES:
      return suggestColumnNameInIndexes(compiler, offset);
    case ScopeKind.REF:
      {
        while (containers.length > 0) {
          const container = containers.pop()!;
          if (container instanceof InfixExpressionNode && container.op?.value === '.') {
            return suggestMembers(
              compiler,
              offset,
              container as InfixExpressionNode & { op: { value: '.' } },
            );
          }
        }
      }

      return suggestInRefField(compiler, offset);
    default:
      break;
  }

  return noSuggestions();
}

function suggestInCommaExpression (compiler: Compiler, offset: number): CompletionList {
  const scopeKind = compiler.container.scopeKind(offset);

  // CommaExpressionNode is used in records data rows
  if (scopeKind === ScopeKind.RECORDS) {
    // In records, suggest enum values if applicable
    return suggestNamesInScope(compiler, offset, compiler.container.element(offset), [
      SymbolKind.Schema,
      SymbolKind.Enum,
      SymbolKind.EnumField,
    ]);
  }

  return noSuggestions();
}

function suggestInAttribute (
  compiler: Compiler,
  offset: number,
  container: AttributeNode,
): CompletionList {
  const { token } = compiler.container.token(offset);
  if ([SyntaxTokenKind.COMMA, SyntaxTokenKind.LBRACKET].includes(token?.kind as any)) {
    const res = suggestAttributeName(compiler, offset);

    return token?.kind === SyntaxTokenKind.COMMA && shouldPrependSpace(token, offset)
      ? prependSpace(res)
      : res;
  }

  if (container.name && container.name.start <= offset && container.name.end >= offset) {
    return suggestAttributeName(compiler, offset);
  }

  if (container.name instanceof IdentiferStreamNode) {
    const res = suggestAttributeValue(
      compiler,
      offset,
      extractStringFromIdentifierStream(container.name).unwrap_or(''),
    );

    return (token?.kind === SyntaxTokenKind.COLON && shouldPrependSpace(token, offset)) ? prependSpace(res) : res;
  }

  return noSuggestions();
}

function suggestAttributeName (compiler: Compiler, offset: number): CompletionList {
  const element = compiler.container.element(offset);
  if (element instanceof ProgramNode) return noSuggestions();

  const scopeKind = compiler.container.scopeKind(offset);
  if (element.body && !isOffsetWithinSpan(offset, (element as ElementDeclarationNode).body!)) {
    let attributes: string[];

    switch (scopeKind) {
      case ScopeKind.TABLE:
      case ScopeKind.TABLEPARTIAL:
        attributes = [SettingName.HeaderColor, SettingName.Note];
        break;

      case ScopeKind.TABLEGROUP:
        attributes = [SettingName.Color, SettingName.Note];
        break;

      default:
        attributes = [];
    }

    return {
      suggestions: attributes.map((name) => {
        return {
          label: name,
          insertText: `${name}: `,
          kind: CompletionItemKind.Field,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          range: undefined as any,
        };
      }),
    };
  }

  switch (scopeKind) {
    case ScopeKind.TABLE:
    case ScopeKind.TABLEPARTIAL:
      return {
        suggestions: [
          ...[
            SettingName.PK,
            SettingName.PrimaryKey,
            SettingName.Null,
            SettingName.NotNull,
            SettingName.Increment,
            SettingName.Unique,
          ].map((name) => ({
            label: name,
            insertText: name,
            kind: CompletionItemKind.Property,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          })),
          ...[SettingName.Ref, SettingName.Default, SettingName.Note, SettingName.Check].map((name) => ({
            label: name,
            insertText: `${name}: `,
            kind: CompletionItemKind.Property,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          })),
        ],
      };
    case ScopeKind.ENUM:
      return {
        suggestions: [
          ...[SettingName.Note].map((name) => ({
            label: name,
            insertText: `${name}: `,
            kind: CompletionItemKind.Property,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          })),
        ],
      };
    case ScopeKind.INDEXES:
      return {
        suggestions: [
          ...[SettingName.Unique, SettingName.PK].map((name) => ({
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: CompletionItemKind.Property,
            range: undefined as any,
          })),
          ...[SettingName.Note, SettingName.Name, SettingName.Type].map((name) => ({
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
        suggestions: [
          SettingName.Update,
          SettingName.Delete,
          SettingName.Color,
        ].map((name) => ({
          label: name,
          insertText: `${name}: `,
          kind: CompletionItemKind.Property,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          range: undefined as any,
        })),
      };
    case ScopeKind.CHECKS:
      return {
        suggestions: [
          SettingName.Name,
        ].map((name) => ({
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

function suggestAttributeValue (
  compiler: Compiler,
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
    case 'default':
      return suggestNamesInScope(compiler, offset, compiler.container.element(offset), [
        SymbolKind.Schema,
        SymbolKind.Enum,
      ]);
    default:
      break;
  }

  return noSuggestions();
}

function suggestMembers (
  compiler: Compiler,
  offset: number,
  container: InfixExpressionNode & { op: SyntaxToken },
): CompletionList {
  const fragments = destructureMemberAccessExpression(container).unwrap_or([]);
  fragments.pop(); // The last fragment is not used in suggestions: v1.table.a<>
  if (fragments.some((f) => !isExpressionAVariableNode(f))) {
    return noSuggestions();
  }

  const nameStack = fragments.map((f) => extractVariableFromExpression(f).unwrap());

  return addQuoteIfNeeded({
    suggestions: compiler.symbol
      .ofName(nameStack, compiler.container.element(offset))
      .flatMap(({ symbol }) => compiler.symbol.members(symbol))
      .map(({ kind, name }) => ({
        label: name,
        insertText: name,
        kind: pickCompletionItemKind(kind),
        range: undefined as any,
      })),
  });
}

function suggestInSubField (
  compiler: Compiler,
  offset: number,
  container?: FunctionApplicationNode,
): CompletionList {
  const scopeKind = compiler.container.scopeKind(offset);

  switch (scopeKind) {
    case ScopeKind.TABLE:
    case ScopeKind.TABLEPARTIAL:
      return suggestInColumn(compiler, offset, container);
    case ScopeKind.PROJECT:
      return suggestInProjectField(compiler, offset, container);
    case ScopeKind.INDEXES:
      return suggestInIndex(compiler, offset);
    case ScopeKind.ENUM:
      return suggestInEnumField(compiler, offset, container);
    case ScopeKind.REF: {
      const suggestions = suggestInRefField(compiler, offset);

      return (
        compiler.container.token(offset).token?.kind === SyntaxTokenKind.COLON
        && shouldPrependSpace(compiler.container.token(offset).token, offset)
      )
        ? prependSpace(suggestions)
        : suggestions;
    }
    case ScopeKind.TABLEGROUP:
      return suggestInTableGroupField(compiler);
    default:
      return noSuggestions();
  }
}

function suggestTopLevelElementType (): CompletionList {
  return {
    suggestions: [
      ...['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial', 'Records'].map((name) => ({
        label: name,
        insertText: name,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.Keyword,
        range: undefined as any,
      })),
    ],
  };
}

function suggestInEnumField (
  compiler: Compiler,
  offset: number,
  container?: FunctionApplicationNode,
): CompletionList {
  if (!container?.callee) {
    return noSuggestions();
  }
  const containerArgId = findContainerArg(offset, container);

  if (containerArgId === 1) {
    return suggestNamesInScope(compiler, offset, compiler.container.element(offset), [
      SymbolKind.Schema,
      SymbolKind.Table,
      SymbolKind.Column,
    ]);
  }

  return noSuggestions();
}

function suggestInColumn (
  compiler: Compiler,
  offset: number,
  container?: FunctionApplicationNode,
): CompletionList {
  const elements = ['Note', 'indexes', 'checks'];

  if (!container?.callee) {
    return {
      suggestions: [
        ...elements.map((name) => ({
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.Keyword,
          range: undefined as any,
        })),
        {
          label: 'Records',
          insertText: 'Records',
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.Keyword,
          range: undefined as any,
        },
      ],
    };
  }

  const containerArgId = findContainerArg(offset, container);

  if (containerArgId === 0) {
    return {
      suggestions: [
        ...elements.map((name) => ({
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.Keyword,
          range: undefined as any,
        })),
        {
          label: 'Records',
          insertText: 'Records',
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.Keyword,
          range: undefined as any,
        },
      ],
    };
  }
  if (containerArgId === 1) {
    return suggestColumnType(compiler, offset);
  }

  return noSuggestions();
}

function suggestInProjectField (
  compiler: Compiler,
  offset: number,
  container?: FunctionApplicationNode,
): CompletionList {
  const elements = ['Table', 'TableGroup', 'Enum', 'Note', 'Ref', 'TablePartial'];
  if (!container?.callee) {
    return {
      suggestions: elements.map((name) => ({
        label: name,
        insertText: name,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.Keyword,
        range: undefined as any,
      })),
    };
  }

  const containerArgId = findContainerArg(offset, container);

  if (containerArgId === 0) {
    return {
      suggestions: elements.map((name) => ({
        label: name,
        insertText: name,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.Keyword,
        range: undefined as any,
      })),
    };
  }

  return noSuggestions();
}

function suggestInRefField (compiler: Compiler, offset: number): CompletionList {
  return suggestNamesInScope(compiler, offset, compiler.container.element(offset), [
    SymbolKind.Schema,
    SymbolKind.Table,
    SymbolKind.Column,
  ]);
}

function suggestInRecordsHeader (
  compiler: Compiler,
  offset: number,
  container: ElementDeclarationNode,
): CompletionList {
  return suggestNamesInScope(compiler, offset, container.parent, [
    SymbolKind.Schema,
    SymbolKind.Table,
  ]);
}


function suggestInCallExpression (
  compiler: Compiler,
  offset: number,
  container: CallExpressionNode,
): CompletionList {
  const element = compiler.container.element(offset);

  // Determine if we're in the callee or in the arguments
  const inCallee = container.callee && isOffsetWithinSpan(offset, container.callee);
  const inArgs = container.argumentList && isOffsetWithinSpan(offset, container.argumentList);

  // Check if we're in a Records element header (top-level Records)
  if (
    element instanceof ElementDeclarationNode
    && getElementKind(element).unwrap_or(undefined) === ElementKind.Records
    && isOffsetWithinElementHeader(offset, element)
  ) {
    if (inCallee) {
      return suggestNamesInScope(compiler, offset, element.parent, [
        SymbolKind.Schema,
        SymbolKind.Table,
      ]);
    }

    if (inArgs) {
      const callee = container.callee;
      if (callee) {
        const fragments = destructureMemberAccessExpression(callee).unwrap_or([callee]);
        const rightmostExpr = fragments[fragments.length - 1];
        const tableSymbol = rightmostExpr?.referee;

        if (tableSymbol) {
          let suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [SymbolKind.Column]);
          const { argumentList } = container;
          // If the user already typed some columns, we do not suggest "all columns" anymore
          if (!argumentList || !isTupleEmpty(argumentList)) return suggestions;
          suggestions = excludeSuggestions(suggestions, ['records']);
          suggestions = addExpandAllColumnsSuggestion(suggestions);
          return suggestions;
        }
      }
    }
  }

  // Check if we're inside a Records FunctionApplicationNode (e.g., typing "Records ()")
  const containers = [...compiler.container.stack(offset)];
  for (const c of containers) {
    if (
      c instanceof FunctionApplicationNode
      && isExpressionAVariableNode(c.callee)
      && extractVariableFromExpression(c.callee).unwrap_or('').toLowerCase() === 'records'
    ) {
      // If in callee, suggest schema and table names
      if (inCallee) {
        return suggestNamesInScope(compiler, offset, element, [
          SymbolKind.Schema,
          SymbolKind.Table,
        ]);
      }

      // If in args, suggest column names from the table referenced in the callee
      if (inArgs) {
        const callee = container.callee;
        if (callee) {
          const fragments = destructureMemberAccessExpression(callee).unwrap_or([callee]);
          const rightmostExpr = fragments[fragments.length - 1];
          const tableSymbol = rightmostExpr?.referee;

          if (tableSymbol) {
            let suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [SymbolKind.Column]);
            const { argumentList } = container;
            // If the user already typed some columns, we do not suggest "all columns" anymore
            if (!argumentList || !isTupleEmpty(argumentList)) return suggestions;
            suggestions = excludeSuggestions(suggestions, ['records']);
            suggestions = addExpandAllColumnsSuggestion(suggestions);
            return suggestions;
          }
        }
      }
      break;
    }
  }

  return noSuggestions();
}

function suggestInTableGroupField (compiler: Compiler): CompletionList {
  return {
    suggestions: [
      ...addQuoteIfNeeded({
        suggestions: [...compiler.parse.publicSymbolTable().entries()].flatMap(([index]) => {
          const res = destructureIndex(index).unwrap_or(undefined);
          if (res === undefined) return [];
          const { kind, name } = res;
          if (kind !== SymbolKind.Table && kind !== SymbolKind.Schema) return [];

          return {
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: pickCompletionItemKind(kind),
            range: undefined as any,
          };
        }),
      }).suggestions,
      ...['Note'].map((name) => ({
        label: name,
        insertText: name,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.Keyword,
        range: undefined as any,
      })),
    ],
  };
}

function suggestInIndex (compiler: Compiler, offset: number): CompletionList {
  return suggestColumnNameInIndexes(compiler, offset);
}

function suggestColumnType (compiler: Compiler, offset: number): CompletionList {
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
      ...suggestNamesInScope(compiler, offset, compiler.container.element(offset), [
        SymbolKind.Enum,
        SymbolKind.Schema,
      ]).suggestions,
    ],
  };
}

function suggestColumnNameInIndexes (compiler: Compiler, offset: number): CompletionList {
  const indexesNode = compiler.container.element(offset);
  const tableNode = (indexesNode as any)?.parent;
  if (!(tableNode?.symbol instanceof TableSymbol)) {
    return noSuggestions();
  }

  const { symbolTable } = tableNode.symbol;

  return addQuoteIfNeeded({
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

// Return the index of the argument we're at in an element's subfield
function findContainerArg (offset: number, node: FunctionApplicationNode): number {
  if (!node.callee) return -1;
  const args = [node.callee, ...node.args];

  const containerArgId = args.findIndex((c) => offset <= c.end);

  return containerArgId === -1 ? args.length : containerArgId;
}
