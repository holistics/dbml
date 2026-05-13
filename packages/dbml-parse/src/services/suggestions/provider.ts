import Compiler, { ScopeKind } from '@/compiler';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { isComment } from '@/core/lexer/utils';
import { Filepath } from '@/core/types/filepath';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import {
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  CommaExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  PrefixExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
} from '@/core/types/nodes';
import {
  type NodeSymbol,
  SchemaSymbol,
  SymbolKind,
} from '@/core/types/symbol';
import { SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';
import {
  destructureMemberAccessExpression,
  extractStringFromIdentifierStream,
  extractVariableFromExpression,
  isTupleEmpty,
} from '@/core/utils/expression';
import { isExpressionAVariableNode } from '@/core/utils/validate';
import { isOffsetWithinElementHeader, isOffsetWithinSpan } from '@/core/utils/span';
import { collectCrossFileSuggestions } from '@/services/suggestions/crossFile';
import { suggestRecordRowSnippet } from '@/services/suggestions/recordRowSnippet';
import { suggestUseCompletion } from '@/services/suggestions/use';
import {
  addQuoteToSuggestionIfNeeded,
  addSuggestAllSuggestion,
  noSuggestions,
  pickCompletionItemKind,
  prependSpace,
  shouldPrependSpace,
} from '@/services/suggestions/utils';
import {
  CompletionItemInsertTextRule,
  CompletionItemKind,
  type CompletionItemProvider,
  type CompletionList,
  type Position,
  type TextModel,
} from '@/services/types';
import { getOffsetFromMonacoPosition } from '@/services/utils';

export interface DBMLCompletionItemProviderOptions {
  triggerCharacters?: string[];
}

export default class DBMLCompletionItemProvider implements CompletionItemProvider {
  private compiler: Compiler;

  triggerCharacters: string[];

  constructor (compiler: Compiler, options: DBMLCompletionItemProviderOptions = {}) {
    this.compiler = compiler;
    this.triggerCharacters = options.triggerCharacters ?? [];
  }

  provideCompletionItems (model: TextModel, position: Position): CompletionList {
    const filepath = Filepath.fromUri(String(model.uri));
    const offset = getOffsetFromMonacoPosition(model, position);

    // Try to suggest record row snippet first
    const recordRowSnippet = suggestRecordRowSnippet(this.compiler, model, position, filepath, offset);
    if (recordRowSnippet !== null) {
      return recordRowSnippet;
    }

    const flatStream = this.compiler.token.flatStream(filepath);
    // bOc: before-or-contain
    const {
      token: bOcToken, index: bOcTokenId,
    } = this.compiler.container.token(filepath, offset);
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

    // Use declaration completions take priority over string-literal detection
    // below which would swallow importPath completions.
    const useSuggestion = suggestUseCompletion(this.compiler, filepath, offset, bOcToken, model);
    if (useSuggestion !== null) return useSuggestion;

    // Check if we're inside a string
    if ([
      SyntaxTokenKind.STRING_LITERAL,
      SyntaxTokenKind.QUOTED_STRING,
    ].includes(bOcToken.kind) && isOffsetWithinSpan(offset, bOcToken)) {
      return noSuggestions();
    }

    const element = this.compiler.container.element(filepath, offset);
    if (
      this.compiler.container.scopeKind(filepath, offset) === ScopeKind.TOPLEVEL
      || (element instanceof ElementDeclarationNode
        && element.type
        && element.type.start <= offset
        && element.type.end >= offset)
    ) {
      return suggestTopLevelElementType();
    }

    const containers = [
      ...this.compiler.container.stack(filepath, offset),
    ].reverse();

    for (const container of containers) {
      if (container instanceof PrefixExpressionNode) {
        switch (container.op?.value) {
          case '>':
          case '<':
          case '<>':
          case '-':
            return suggestOnRelOp(
              this.compiler,
              filepath,
              offset,
              container as PrefixExpressionNode & { op: SyntaxToken },
            );
          case '~':
            return suggestOnPartialInjectionOp(
              this.compiler,
              filepath,
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
              filepath,
              offset,
              container as InfixExpressionNode & { op: SyntaxToken },
            );
          case '.':
            return suggestMembers(
              this.compiler,
              filepath,
              offset,
              container as InfixExpressionNode & { op: SyntaxToken },
            );
          default:
        }
      } else if (container instanceof AttributeNode) {
        return suggestInAttribute(this.compiler, filepath, offset, container);
      } else if (container instanceof ListExpressionNode) {
        return suggestInAttribute(this.compiler, filepath, offset, container);
      } else if (container instanceof TupleExpressionNode) {
        return suggestInTuple(this.compiler, filepath, offset, container);
      } else if (container instanceof CommaExpressionNode) {
        return suggestInCommaExpression(this.compiler, filepath, offset);
      } else if (container instanceof CallExpressionNode) {
        return suggestInCallExpression(this.compiler, filepath, offset, container);
      } else if (container instanceof FunctionApplicationNode) {
        return suggestInSubField(this.compiler, filepath, offset, container);
      } else if (container instanceof ElementDeclarationNode) {
        if (isOffsetWithinElementHeader(offset, container)) {
          return suggestInElementHeader(this.compiler, filepath, offset, container);
        }

        if (
          (container.bodyColon && offset >= container.bodyColon.end)
          || (container.body && isOffsetWithinSpan(offset, container.body))
        ) {
          return suggestInSubField(this.compiler, filepath, offset, undefined);
        }
      }
    }

    return noSuggestions();
  }
}

function suggestOnPartialInjectionOp (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
) {
  return suggestNamesInScope(compiler, filepath, offset, compiler.parse.ast(filepath), [
    SymbolKind.TablePartial,
  ]);
}

function suggestOnRelOp (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  container: (PrefixExpressionNode | InfixExpressionNode) & { op: SyntaxToken },
): CompletionList {
  const scopeKind = compiler.container.scopeKind(filepath, offset);

  if ([
    ScopeKind.REF,
    ScopeKind.TABLE,
    ScopeKind.TABLEPARTIAL,
  ].includes(scopeKind)) {
    const res = suggestNamesInScope(compiler, filepath, offset, compiler.container.element(filepath, offset), [
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
        if (member instanceof SchemaSymbol && member.isPublicSchema()) return false;
        return true;
      })
      .flatMap((member) => {
        const name = member.name;
        if (name === undefined) return [];
        // Every suggestion shows where it comes from so users can tell
        // local vs imported names apart. `this file` for symbols declared
        // in the currently-open file; `from <basename>` for imports.
        const originFp = member.originalFilepath;
        const detail = originFp && !originFp.equals(symbol.filepath)
          ? `from ${originFp.basename}`
          : 'this file';
        return {
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: pickCompletionItemKind(member.kind),
          sortText: pickCompletionItemKind(member.kind).toString().padStart(2, '0'),
          detail,
          range: undefined as any,
        };
      })
      .filter((s) => s.label !== ''),
  });
}

function suggestNamesInScope (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  parent: ElementDeclarationNode | ProgramNode | undefined,
  acceptedKinds: SymbolKind[],
): CompletionList {
  if (parent === undefined) {
    return noSuggestions();
  }

  let curElement: SyntaxNode | undefined = parent;
  const res: CompletionList = {
    suggestions: [],
  };
  let programNode: ProgramNode | undefined;
  while (curElement) {
    if (curElement instanceof ProgramNode) programNode = curElement;
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

  // Global-scope lookups should also surface symbols that live in other
  // project files. They come back with an additionalTextEdit that inserts the
  // matching `use { ... }` statement when the suggestion is accepted.
  if (programNode?.filepath) {
    const fp = programNode.filepath;
    const seen = new Set(res.suggestions.map((s) => typeof s.label === 'string' ? s.label : s.label.label));
    for (const item of collectCrossFileSuggestions(compiler, acceptedKinds, fp)) {
      const name = typeof item.label === 'string' ? item.label : item.label.label;
      if (seen.has(name)) continue;
      seen.add(name);
      res.suggestions.push(item);
    }
  }

  return addQuoteToSuggestionIfNeeded(res);
}

function suggestInTuple (compiler: Compiler, filepath: Filepath, offset: number, tupleContainer: TupleExpressionNode): CompletionList {
  const scopeKind = compiler.container.scopeKind(filepath, offset);
  const element = compiler.container.element(filepath, offset);

  // Check if we're inside a CallExpression - delegate to suggestInCallExpression
  const containers = [
    ...compiler.container.stack(filepath, offset),
  ];
  for (const c of containers) {
    if (c instanceof CallExpressionNode && c.argumentList === tupleContainer) {
      return suggestInCallExpression(compiler, filepath, offset, c);
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
      const suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [
        SymbolKind.Column,
      ]);
      // If the user already typed some columns, we do not suggest "all columns" anymore
      if (!isTupleEmpty(tupleContainer)) return suggestions;
      return addSuggestAllSuggestion(suggestions);
    }
  }

  switch (scopeKind) {
    case ScopeKind.INDEXES:
      return suggestColumnNameInIndexes(compiler, filepath, offset);
    case ScopeKind.REF:
      {
        while (containers.length > 0) {
          const container = containers.pop()!;
          if (container instanceof InfixExpressionNode && container.op?.value === '.') {
            return suggestMembers(
              compiler,
              filepath,
              offset,
              container as InfixExpressionNode & { op: { value: '.' } },
            );
          }
        }
      }

      return suggestInRefField(compiler, filepath, offset);
    default:
      break;
  }

  return noSuggestions();
}

function suggestInCommaExpression (compiler: Compiler, filepath: Filepath, offset: number): CompletionList {
  const scopeKind = compiler.container.scopeKind(filepath, offset);

  // CommaExpressionNode is used in records data rows
  if (scopeKind === ScopeKind.RECORDS) {
    // In records, suggest enum values if applicable
    return suggestNamesInScope(compiler, filepath, offset, compiler.container.element(filepath, offset), [
      SymbolKind.Schema,
      SymbolKind.Enum,
      SymbolKind.EnumField,
    ]);
  }

  return noSuggestions();
}

function suggestInAttribute (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  container: AttributeNode,
): CompletionList {
  const {
    token,
  } = compiler.container.token(filepath, offset);
  if ([
    SyntaxTokenKind.COMMA,
    SyntaxTokenKind.LBRACKET,
  ].includes(token?.kind as any)) {
    const res = suggestAttributeName(compiler, filepath, offset);

    return token?.kind === SyntaxTokenKind.COMMA && shouldPrependSpace(token, offset)
      ? prependSpace(res)
      : res;
  }

  if (container.name && container.name.start <= offset && container.name.end >= offset) {
    return suggestAttributeName(compiler, filepath, offset);
  }

  if (container.name instanceof IdentifierStreamNode) {
    const res = suggestAttributeValue(
      compiler,
      filepath,
      offset,
      extractStringFromIdentifierStream(container.name) ?? '',
    );

    return (token?.kind === SyntaxTokenKind.COLON && shouldPrependSpace(token, offset)) ? prependSpace(res) : res;
  }

  return noSuggestions();
}

function suggestAttributeName (compiler: Compiler, filepath: Filepath, offset: number): CompletionList {
  const element = compiler.container.element(filepath, offset);
  if (element instanceof ProgramNode) return noSuggestions();

  const scopeKind = compiler.container.scopeKind(filepath, offset);
  if (element.body && !isOffsetWithinSpan(offset, (element as ElementDeclarationNode).body!)) {
    let attributes: string[];

    switch (scopeKind) {
      case ScopeKind.TABLE:
      case ScopeKind.TABLEPARTIAL:
        attributes = [
          SettingName.HeaderColor,
          SettingName.Note,
        ];
        break;

      case ScopeKind.TABLEGROUP:
        attributes = [
          SettingName.Color,
          SettingName.Note,
        ];
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
          ...[
            SettingName.Ref,
            SettingName.Default,
            SettingName.Note,
            SettingName.Check,
          ].map((name) => ({
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
          ...[
            SettingName.Note,
          ].map((name) => ({
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
          ...[
            SettingName.Unique,
            SettingName.PK,
          ].map((name) => ({
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: CompletionItemKind.Property,
            range: undefined as any,
          })),
          ...[
            SettingName.Note,
            SettingName.Name,
            SettingName.Type,
          ].map((name) => ({
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
          {
            label: SettingName.Inactive,
            insertText: SettingName.Inactive,
            kind: CompletionItemKind.Property,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          },
          ...[
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
        ],
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
  filepath: Filepath,
  offset: number,
  settingName: string,
): CompletionList {
  switch (settingName?.toLowerCase()) {
    case 'update':
    case 'delete':
      return {
        suggestions: [
          'cascade',
          'set default',
          'set null',
          'restrict',
        ].map((name) => ({
          label: name,
          insertText: name,
          kind: CompletionItemKind.Value,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          range: undefined as any,
        })),
      };
    case 'type':
      return {
        suggestions: [
          'btree',
          'hash',
        ].map((name) => ({
          label: name,
          insertText: `${name}`,
          kind: CompletionItemKind.Value,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          range: undefined as any,
        })),
      };
    case 'default':
      return suggestNamesInScope(compiler, filepath, offset, compiler.container.element(filepath, offset), [
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
      const memberName = member.name;
      return memberName === name;
    });
    if (matching.length === 0) return [];
    candidates = matching;
  }

  return candidates;
}

function suggestMembers (
  compiler: Compiler,
  filepath: Filepath,
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
  const resolvedSymbols = resolveNameStack(compiler, nameStack, compiler.container.element(filepath, offset));

  return addQuoteToSuggestionIfNeeded({
    suggestions: resolvedSymbols
      .flatMap((symbol) => compiler.symbolMembers(symbol).getFiltered(UNHANDLED) || [])
      .flatMap((member) => {
        const name = member.name;
        if (name === undefined) return [];
        return {
          label: name,
          insertText: name,
          kind: pickCompletionItemKind(member.kind),
          range: undefined as any,
        };
      }),
  });
}

function suggestInSubField (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  container?: FunctionApplicationNode,
): CompletionList {
  const scopeKind = compiler.container.scopeKind(filepath, offset);

  switch (scopeKind) {
    case ScopeKind.TABLE:
    case ScopeKind.TABLEPARTIAL:
      return suggestInColumn(compiler, filepath, offset, container);
    case ScopeKind.PROJECT:
      return suggestInProjectField(compiler, filepath, offset, container);
    case ScopeKind.INDEXES:
      return suggestInIndex(compiler, filepath, offset);
    case ScopeKind.ENUM:
      return suggestInEnumField(compiler, filepath, offset, container);
    case ScopeKind.REF: {
      const suggestions = suggestInRefField(compiler, filepath, offset);

      return (
        compiler.container.token(filepath, offset).token?.kind === SyntaxTokenKind.COLON
        && shouldPrependSpace(compiler.container.token(filepath, offset).token, offset)
      )
        ? prependSpace(suggestions)
        : suggestions;
    }
    case ScopeKind.TABLEGROUP:
      return suggestInTableGroupField(compiler, filepath);
    case ScopeKind.DIAGRAMVIEW:
      return suggestInDiagramViewBody();
    case ScopeKind.CUSTOM: {
      const elem = compiler.container.element(filepath, offset);
      if (elem instanceof ElementDeclarationNode) {
        const bodyBlock = elem.parentNode;
        const parentElem = bodyBlock instanceof BlockExpressionNode ? bodyBlock.parentNode : undefined;
        if (parentElem instanceof ElementDeclarationNode && parentElem.isKind(ElementKind.DiagramView)) {
          return suggestInDiagramViewSubBlock(compiler, filepath, offset, elem);
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
    suggestions: [
      'Table',
      'TableGroup',
      'Enum',
      'Project',
      'Ref',
      'TablePartial',
      'Records',
      'DiagramView',
    ].map((name) => ({
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
  filepath: Filepath,
  offset: number,
  container?: FunctionApplicationNode,
): CompletionList {
  if (!container?.callee) {
    return noSuggestions();
  }
  const containerArgId = findContainerArg(offset, container);

  if (containerArgId === 1) {
    return suggestNamesInScope(compiler, filepath, offset, compiler.container.element(filepath, offset), [
      SymbolKind.Schema,
      SymbolKind.Table,
      SymbolKind.Column,
    ]);
  }

  return noSuggestions();
}

function suggestInColumn (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  container?: FunctionApplicationNode,
): CompletionList {
  const elements = [
    'Note',
    'indexes',
    'checks',
    'Records',
  ];

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
    return suggestColumnType(compiler, filepath, offset);
  }

  return noSuggestions();
}

function suggestInProjectField (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  container?: FunctionApplicationNode,
): CompletionList {
  const elements = [
    'Table',
    'TableGroup',
    'Enum',
    'Note',
    'Ref',
    'TablePartial',
  ];
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

function suggestInRefField (compiler: Compiler, filepath: Filepath, offset: number): CompletionList {
  return suggestNamesInScope(compiler, filepath, offset, compiler.container.element(filepath, offset), [
    SymbolKind.Schema,
    SymbolKind.Table,
    SymbolKind.Column,
  ]);
}

function suggestInElementHeader (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  container: ElementDeclarationNode,
): CompletionList {
  if (container.isKind(ElementKind.Records)) {
    return suggestNamesInScope(compiler, filepath, offset, container.parent, [
      SymbolKind.Schema,
      SymbolKind.Table,
    ]);
  }
  return noSuggestions();
}

function suggestInCallExpression (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  container: CallExpressionNode,
): CompletionList {
  const element = compiler.container.element(filepath, offset);

  // Determine if we're in the callee or in the arguments
  const inCallee = container.callee && isOffsetWithinSpan(offset, container.callee);
  const inArgs = container.argumentList && isOffsetWithinSpan(offset, container.argumentList);

  // Check if we're in a Records element header (top-level Records)
  if (
    element instanceof ElementDeclarationNode
    && element.isKind(ElementKind.Records)
    && isOffsetWithinElementHeader(offset, element)
  ) {
    if (inCallee) return suggestNamesInScope(compiler, filepath, offset, element.parent, [
      SymbolKind.Schema,
      SymbolKind.Table,
    ]);
    if (!inArgs) return noSuggestions();

    const callee = container.callee;
    if (!callee) return noSuggestions();

    const fragments = destructureMemberAccessExpression(callee) ?? [
      callee,
    ];
    const rightmostExpr = fragments[fragments.length - 1];
    const tableSymbol = rightmostExpr ? compiler.nodeReferee(rightmostExpr).getFiltered(UNHANDLED) : undefined;

    if (!tableSymbol) return noSuggestions();
    const suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [
      SymbolKind.Column,
    ]);
    const {
      argumentList,
    } = container;
    // If the user already typed some columns, we do not suggest "all columns" anymore
    if (!argumentList || !isTupleEmpty(argumentList)) return suggestions;
    return addSuggestAllSuggestion(suggestions);
  }

  // Check if we're inside a Records FunctionApplicationNode (e.g., typing "Records ()")
  // Example:
  // Table T {
  //   Records () // This is currently treated as a CallExpressionNode
  // }
  const containers = [
    ...compiler.container.stack(filepath, offset),
  ];
  for (const c of containers) {
    if (!inArgs) continue;
    if (!(c instanceof FunctionApplicationNode)) continue;
    if (c.callee !== container) continue;
    if ((extractVariableFromExpression(container.callee) ?? '').toLowerCase() !== ElementKind.Records) continue;
    const tableSymbol = compiler.nodeSymbol(compiler.container.element(filepath, offset)).getFiltered(UNHANDLED);
    if (!tableSymbol) return noSuggestions();
    const suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [
      SymbolKind.Column,
    ]);
    const {
      argumentList,
    } = container;
    // If the user already typed some columns, we do not suggest "all columns" anymore
    if (!argumentList || !isTupleEmpty(argumentList)) return suggestions;
    return addSuggestAllSuggestion(suggestions);
  }

  return noSuggestions();
}

function suggestInTableGroupField (compiler: Compiler, filepath: Filepath): CompletionList {
  const publicMembers = compiler.parse.publicSymbolTable(filepath) ?? [];
  return {
    suggestions: [
      ...addQuoteToSuggestionIfNeeded({
        suggestions: publicMembers.flatMap((member) => {
          if (member.kind !== SymbolKind.Table && member.kind !== SymbolKind.Schema) return [];
          const name = member.name;
          if (name === undefined) return [];
          // Skip the default 'public' schema
          if (member instanceof SchemaSymbol && member.isPublicSchema()) return [];

          return {
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: pickCompletionItemKind(member.kind),
            range: undefined as any,
          };
        }),
      }).suggestions,
      ...[
        'Note',
      ].map((name) => ({
        label: name,
        insertText: name,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.Keyword,
        range: undefined as any,
      })),
    ],
  };
}

function suggestInIndex (compiler: Compiler, filepath: Filepath, offset: number): CompletionList {
  return suggestColumnNameInIndexes(compiler, filepath, offset);
}

function suggestColumnType (compiler: Compiler, filepath: Filepath, offset: number): CompletionList {
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
      ...suggestNamesInScope(compiler, filepath, offset, compiler.container.element(filepath, offset), [
        SymbolKind.Enum,
        SymbolKind.Schema,
      ]).suggestions,
    ],
  };
}

function suggestColumnNameInIndexes (compiler: Compiler, filepath: Filepath, offset: number): CompletionList {
  const indexesNode = compiler.container.element(filepath, offset);
  const tableNode = (indexesNode as any)?.parent;
  const tableSymbol = tableNode ? compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED) : undefined;
  if (!tableSymbol || !tableSymbol?.isKind(SymbolKind.Table)) {
    return noSuggestions();
  }

  const members = compiler.symbolMembers(tableSymbol).getFiltered(UNHANDLED);
  if (!members) return noSuggestions();

  return addQuoteToSuggestionIfNeeded({
    suggestions: members.flatMap((member) => {
      const nameResult = member.declaration ? compiler.nodeFullname(member.declaration) : undefined;
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
  const args = [
    node.callee,
    ...node.args,
  ];

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
      ...[
        'Tables',
        'TableGroups',
        'Notes',
        'Schemas',
      ].map((name) => ({
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
  filepath: Filepath,
  offset: number,
  elem: ElementDeclarationNode,
): CompletionList {
  const blockType = elem.type?.value.toLowerCase();
  switch (blockType) {
    case 'tables': {
      const namesInScope = suggestNamesInScope(compiler, filepath, offset, compiler.parse.ast(filepath), [
        SymbolKind.Table,
        SymbolKind.Schema,
      ]);
      return {
        suggestions: [
          wildcardSuggestion,
          ...namesInScope.suggestions,
        ],
      };
    }
    case 'tablegroups': {
      const namesInScope = suggestNamesInScope(compiler, filepath, offset, compiler.parse.ast(filepath), [
        SymbolKind.TableGroup,
      ]);
      return {
        suggestions: [
          wildcardSuggestion,
          ...namesInScope.suggestions,
        ],
      };
    }
    case 'schemas': {
      const defaultSchema = {
        label: DEFAULT_SCHEMA_NAME,
        insertText: DEFAULT_SCHEMA_NAME,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.Module,
        range: undefined as any,
      };
      const namesInScope = suggestNamesInScope(compiler, filepath, offset, compiler.parse.ast(filepath), [
        SymbolKind.Schema,
      ]);
      return {
        suggestions: [
          wildcardSuggestion,
          defaultSchema,
          ...namesInScope.suggestions,
        ],
      };
    }
    case 'notes': {
      const namesInScope = suggestNamesInScope(compiler, filepath, offset, compiler.parse.ast(filepath), [
        SymbolKind.StickyNote,
      ]);
      return {
        suggestions: [
          wildcardSuggestion,
          ...namesInScope.suggestions,
        ],
      };
    }
    default:
      return noSuggestions();
  }
}
