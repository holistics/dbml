import {
  destructureMemberAccessExpression,
  extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  extractStringFromIdentifierStream,
  isExpressionAVariableNode,
} from '@/core/utils/expression';
import Compiler, { ScopeKind } from '@/compiler';
import { SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';
import { isOffsetWithinSpan } from '@/core/utils/span';
import {
  type CompletionList,
  type TextModel,
  type CompletionItemProvider,
  type Position,
  CompletionItemKind,
  CompletionItemInsertTextRule,
} from '@/services/types';
import { type NodeSymbol } from '@/core/types/symbols';
import { SymbolKind } from '@/core/types/symbols';
import {
  pickCompletionItemKind,
  shouldPrependSpace,
  addQuoteToSuggestionIfNeeded,
  noSuggestions,
  prependSpace,
  isOffsetWithinElementHeader,
  addSuggestAllSuggestion,
  isTupleEmpty,
} from '@/services/suggestions/utils';
import { suggestRecordRowSnippet } from '@/services/suggestions/recordRowSnippet';
import {
  AttributeNode,
  BlockExpressionNode,
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
} from '@/core/types/nodes';
import { getOffsetFromMonacoPosition } from '@/services/utils';
import { isComment } from '@/core/lexer/utils';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { UNHANDLED, DEFAULT_SCHEMA_NAME } from '@/constants';

export default class DBMLCompletionItemProvider implements CompletionItemProvider {
  private compiler: Compiler;

  triggerCharacters: string[];

  constructor (compiler: Compiler, triggerCharacters: string[] = []) {
    this.compiler = compiler;
    this.triggerCharacters = triggerCharacters;
  }

  provideCompletionItems (model: TextModel, position: Position): CompletionList {
    const offset = getOffsetFromMonacoPosition(model, position);

    // Try to suggest record row snippet first
    const recordRowSnippet = suggestRecordRowSnippet(this.compiler, model, position, offset);
    if (recordRowSnippet !== null) {
      return recordRowSnippet;
    }

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
        if (isOffsetWithinElementHeader(offset, container)) {
          return suggestInElementHeader(this.compiler, offset, container);
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
  const members = compiler.symbolMembers(symbol).getFiltered(UNHANDLED);
  if (!members) return noSuggestions();
  return addQuoteToSuggestionIfNeeded({
    suggestions: members
      .filter((member) => acceptedKinds.includes(member.kind))
      .filter((member) => {
        // Also exclude the default 'public' schema since it's implicit.
        if (member.isPublicSchema()) return false;
        return true;
      })
      .flatMap((member) => {
        const name = compiler.symbolName(member);
        if (name === undefined) return [];
        return {
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: pickCompletionItemKind(member.kind),
          sortText: pickCompletionItemKind(member.kind).toString().padStart(2, '0'),
          range: undefined as any,
        };
      })
      .filter((s) => s.label !== ''),
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
    const symbol = compiler.nodeSymbol(curElement).getFiltered(UNHANDLED);
    if (symbol) {
      const memberSuggestions = suggestMembersOfSymbol(compiler, symbol, acceptedKinds).suggestions;
      // Sort within each scope level: columns first, then schemas, then tables/other
      const kindPriority = (kind: number): number => {
        switch (kind) {
          case CompletionItemKind.Field: return 0; // Column
          case CompletionItemKind.Module: return 1; // Schema
          case CompletionItemKind.Class: return 2; // Table
          default: return 3;
        }
      };
      memberSuggestions.sort((a, b) => kindPriority(a.kind) - kindPriority(b.kind));
      res.suggestions.push(...memberSuggestions);
    }
    curElement = curElement instanceof ElementDeclarationNode ? curElement.parent : undefined;
  }

  return addQuoteToSuggestionIfNeeded(res);
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
    && element.isKind(ElementKind.Records)
    && !(element.name instanceof CallExpressionNode)
    && isOffsetWithinElementHeader(offset, element)
  ) {
    const parentSymbol = element.parent ? compiler.nodeSymbol(element.parent).getFiltered(UNHANDLED) : undefined;
    const refereeSymbol = element.name ? compiler.nodeReferee(element.name).getFiltered(UNHANDLED) : undefined;

    const tableSymbol = parentSymbol || refereeSymbol;
    if (tableSymbol) {
      const suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [SymbolKind.Column]);
      // If the user already typed some columns, we do not suggest "all columns" anymore
      if (!isTupleEmpty(tupleContainer)) return suggestions;
      return addSuggestAllSuggestion(suggestions);
    }
  }

  switch (scopeKind) {
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
      extractStringFromIdentifierStream(container.name) ?? '',
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

// Resolve a name stack (e.g. ['schema', 'table']) to matching symbols
// by walking from the scope element's symbol through its members
function resolveNameStack (
  compiler: Compiler,
  nameStack: string[],
  scopeElement: SyntaxNode | undefined,
): NodeSymbol[] {
  if (!scopeElement) return [];

  // Collect all symbols from the scope hierarchy
  let candidates: NodeSymbol[] = [];
  let curElement: SyntaxNode | undefined = scopeElement;
  while (curElement) {
    const symbol = compiler.nodeSymbol(curElement).getFiltered(UNHANDLED);
    if (symbol) {
      const members = compiler.symbolMembers(symbol).getFiltered(UNHANDLED);
      candidates.push(...members || []);
    }
    curElement = curElement instanceof ElementDeclarationNode ? curElement.parent : undefined;
  }

  // Walk through the name stack
  for (const name of nameStack) {
    const matching = candidates.filter((member) => {
      const memberName = compiler.symbolName(member);
      return memberName === name;
    });
    if (matching.length === 0) return [];
    candidates = matching;
  }

  return candidates;
}

function suggestMembers (
  compiler: Compiler,
  offset: number,
  container: InfixExpressionNode & { op: SyntaxToken },
): CompletionList {
  const fragments = destructureMemberAccessExpression(container) ?? [];
  fragments.pop(); // The last fragment is not used in suggestions: v1.table.a<>
  if (fragments.some((f) => !isExpressionAVariableNode(f))) {
    return noSuggestions();
  }

  const nameStack = fragments.map((f) => extractVariableFromExpression(f)!);

  // Resolve the name stack by walking from the scope's symbol through members
  const resolvedSymbols = resolveNameStack(compiler, nameStack, compiler.container.element(offset));

  return addQuoteToSuggestionIfNeeded({
    suggestions: resolvedSymbols
      .flatMap((symbol) => compiler.symbolMembers(symbol).getFiltered(UNHANDLED) || [])
      .map((member) => {
        const name = compiler.symbolName(member)!;
        return {
          label: name,
          insertText: name,
          kind: pickCompletionItemKind(member.kind),
          range: undefined as any,
        };
      })
      .filter((s) => s.label !== ''),
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
    case ScopeKind.DIAGRAMVIEW:
      return suggestInDiagramViewBody();
    case ScopeKind.CUSTOM: {
      const elem = compiler.container.element(offset);
      if (elem instanceof ElementDeclarationNode) {
        const bodyBlock = elem.parentNode;
        const parentElem = bodyBlock instanceof BlockExpressionNode ? bodyBlock.parentNode : undefined;
        if (parentElem instanceof ElementDeclarationNode && parentElem.isKind(ElementKind.DiagramView)) {
          return suggestInDiagramViewSubBlock(compiler, offset, elem);
        }
      }
      return noSuggestions();
    }
    default:
      return noSuggestions();
  }
}

function suggestTopLevelElementType (): CompletionList {
  return {
    suggestions: ['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial', 'Records', 'DiagramView'].map((name) => ({
      label: name,
      insertText: name,
      insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
      kind: CompletionItemKind.Keyword,
      range: undefined as any,
    })),
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
  const elements = ['Note', 'indexes', 'checks', 'Records'];

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

function suggestInElementHeader (
  compiler: Compiler,
  offset: number,
  container: ElementDeclarationNode,
): CompletionList {
  if (container.isKind(ElementKind.Records)) {
    return suggestNamesInScope(compiler, offset, container.parent, [
      SymbolKind.Schema,
      SymbolKind.Table,
    ]);
  }
  return noSuggestions();
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
    && element.isKind(ElementKind.Records)
    && isOffsetWithinElementHeader(offset, element)
  ) {
    if (inCallee) return suggestNamesInScope(compiler, offset, element.parent, [
      SymbolKind.Schema,
      SymbolKind.Table,
    ]);
    if (!inArgs) return noSuggestions();

    const callee = container.callee;
    if (!callee) return noSuggestions();

    const fragments = destructureMemberAccessExpression(callee) ?? [callee];
    const rightmostExpr = fragments[fragments.length - 1];
    const tableSymbol = rightmostExpr ? compiler.nodeReferee(rightmostExpr).getFiltered(UNHANDLED) : undefined;

    if (!tableSymbol) return noSuggestions();
    const suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [SymbolKind.Column]);
    const { argumentList } = container;
    // If the user already typed some columns, we do not suggest "all columns" anymore
    if (!argumentList || !isTupleEmpty(argumentList)) return suggestions;
    return addSuggestAllSuggestion(suggestions);
  }

  // Check if we're inside a Records FunctionApplicationNode (e.g., typing "Records ()")
  // Example:
  // Table T {
  //   Records () // This is currently treated as a CallExpressionNode
  // }
  const containers = [...compiler.container.stack(offset)];
  for (const c of containers) {
    if (!inArgs) continue;
    if (!(c instanceof FunctionApplicationNode)) continue;
    if (c.callee !== container) continue;
    if ((extractVariableFromExpression(container.callee) ?? '').toLowerCase() !== ElementKind.Records) continue;
    const tableSymbol = compiler.nodeSymbol(compiler.container.element(offset)).getFiltered(UNHANDLED);
    if (!tableSymbol) return noSuggestions();
    const suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [SymbolKind.Column]);
    const { argumentList } = container;
    // If the user already typed some columns, we do not suggest "all columns" anymore
    if (!argumentList || !isTupleEmpty(argumentList)) return suggestions;
    return addSuggestAllSuggestion(suggestions);
  }

  return noSuggestions();
}

function suggestInTableGroupField (compiler: Compiler): CompletionList {
  const publicMembers = compiler.parse.publicSymbolTable() ?? [];
  return {
    suggestions: [
      ...addQuoteToSuggestionIfNeeded({
        suggestions: publicMembers.flatMap((member) => {
          if (member.kind !== SymbolKind.Table && member.kind !== SymbolKind.Schema) return [];
          const name = compiler.symbolName(member);
          if (name === undefined) return [];
          // Skip the default 'public' schema
          if (member.isPublicSchema()) return [];

          return {
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: pickCompletionItemKind(member.kind),
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
  const tableSymbol = tableNode ? compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED) : undefined;
  if (!tableSymbol || !tableSymbol?.isKind(SymbolKind.Table)) {
    return noSuggestions();
  }

  const members = compiler.symbolMembers(tableSymbol).getFiltered(UNHANDLED);
  if (!members) return noSuggestions();

  return addQuoteToSuggestionIfNeeded({
    suggestions: members.flatMap((member) => {
      const nameResult = member.declaration ? compiler.fullname(member.declaration) : undefined;
      const name = (nameResult && !nameResult.hasValue(UNHANDLED)) ? nameResult.getValue()?.at(-1) : undefined;
      if (!name) return [];

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

const wildcardSuggestion = {
  label: '*',
  insertText: '*',
  insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
  kind: CompletionItemKind.Keyword,
  range: undefined as any,
};

function suggestInDiagramViewBody (): CompletionList {
  return {
    suggestions: [
      ...['Tables', 'TableGroups', 'Notes', 'Schemas'].map((name) => ({
        label: name,
        insertText: name,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.Keyword,
        range: undefined as any,
      })),
      wildcardSuggestion,
    ],
  };
}

function suggestInDiagramViewSubBlock (
  compiler: Compiler,
  offset: number,
  elem: ElementDeclarationNode,
): CompletionList {
  const blockType = elem.type?.value.toLowerCase();
  switch (blockType) {
    case 'tables': {
      const namesInScope = suggestNamesInScope(compiler, offset, compiler.parse.ast(), [SymbolKind.Table, SymbolKind.Schema]);
      return { suggestions: [wildcardSuggestion, ...namesInScope.suggestions] };
    }
    case 'tablegroups': {
      const namesInScope = suggestNamesInScope(compiler, offset, compiler.parse.ast(), [SymbolKind.TableGroup]);
      return { suggestions: [wildcardSuggestion, ...namesInScope.suggestions] };
    }
    case 'schemas': {
      const defaultSchema = {
        label: DEFAULT_SCHEMA_NAME,
        insertText: DEFAULT_SCHEMA_NAME,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.Module,
        range: undefined as any,
      };
      const namesInScope = suggestNamesInScope(compiler, offset, compiler.parse.ast(), [SymbolKind.Schema]);
      return { suggestions: [wildcardSuggestion, defaultSchema, ...namesInScope.suggestions] };
    }
    case 'notes': {
      const namesInScope = suggestNamesInScope(compiler, offset, compiler.parse.ast(), [SymbolKind.Note]);
      return { suggestions: [wildcardSuggestion, ...namesInScope.suggestions] };
    }
    default:
      return noSuggestions();
  }
}
