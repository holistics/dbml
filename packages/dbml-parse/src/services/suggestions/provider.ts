import {
  destructureMemberAccessExpression,
  extractVariableFromExpression,
  getElementKind,
} from '@/core/analyzer/utils';
import {
  extractStringFromIdentifierStream,
  isExpressionAVariableNode,
} from '@/core/parser/utils';
import Compiler, { ScopeKind } from '@/compiler';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { isOffsetWithinSpan } from '@/core/analyzer/utils';
import {
  type CompletionItem,
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
import { getOffsetFromMonacoPosition, getFilepathFromModel } from '@/services/utils';
import type { Filepath } from '@/compiler/projectLayout';
import { ROOT } from '@/compiler/constants';
import { ExternalSymbol } from '@/core/analyzer/symbol/symbols';
import { isComment } from '@/core/lexer/utils';
import { ElementKind, SettingName } from '@/core/analyzer/types';

export default class DBMLCompletionItemProvider implements CompletionItemProvider {
  private compiler: Compiler;

  triggerCharacters: string[];

  constructor (compiler: Compiler, triggerCharacters: string[] = []) {
    this.compiler = compiler;
    this.triggerCharacters = triggerCharacters;
  }

  provideCompletionItems (model: TextModel, position: Position): CompletionList {
    const offset = getOffsetFromMonacoPosition(model, position);
    const filepath = getFilepathFromModel(model);

    // Try to suggest record row snippet first
    const recordRowSnippet = suggestRecordRowSnippet(this.compiler, model, position, offset);
    if (recordRowSnippet !== null) {
      return recordRowSnippet;
    }

    const flatStream = this.compiler.token.flatStream(filepath);
    // bOc: before-or-contain
    const { token: bOcToken, index: bOcTokenId } = this.compiler.container.token(offset, filepath);
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

    const element = this.compiler.container.element(offset, filepath);
    if (
      this.compiler.container.scopeKind(offset, filepath) === ScopeKind.TOPLEVEL
      || (element instanceof ElementDeclarationNode
        && element.type
        && element.type.start <= offset
        && element.type.end >= offset)
    ) {
      return suggestTopLevelElementType();
    }

    const containers = [...this.compiler.container.stack(offset, filepath)].reverse();

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
              filepath,
            );
          case '~':
            return suggestOnPartialInjectionOp(
              this.compiler,
              offset,
              filepath,
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
              filepath,
            );
          case '.':
            return suggestMembers(
              this.compiler,
              offset,
              container as InfixExpressionNode & { op: SyntaxToken },
              filepath,
            );
          default:
        }
      } else if (container instanceof AttributeNode) {
        return suggestInAttribute(this.compiler, offset, container, filepath);
      } else if (container instanceof ListExpressionNode) {
        return suggestInAttribute(this.compiler, offset, container, filepath);
      } else if (container instanceof TupleExpressionNode) {
        return suggestInTuple(this.compiler, offset, container, filepath);
      } else if (container instanceof CommaExpressionNode) {
        return suggestInCommaExpression(this.compiler, offset, filepath);
      } else if (container instanceof CallExpressionNode) {
        return suggestInCallExpression(this.compiler, offset, container, filepath);
      } else if (container instanceof FunctionApplicationNode) {
        return suggestInSubField(this.compiler, offset, container, filepath);
      } else if (container instanceof ElementDeclarationNode) {
        if (isOffsetWithinElementHeader(offset, container)) {
          return suggestInElementHeader(this.compiler, offset, container, filepath);
        }

        if (
          (container.bodyColon && offset >= container.bodyColon.end)
          || (container.body && isOffsetWithinSpan(offset, container.body))
        ) {
          return suggestInSubField(this.compiler, offset, undefined, filepath);
        }
      }
    }

    return noSuggestions();
  }
}

function suggestOnPartialInjectionOp (
  compiler: Compiler,
  offset: number,

  filepath: Filepath) {
  return suggestNamesInScope(compiler, offset, compiler.ast(filepath), [SymbolKind.TablePartial], filepath);
}

function suggestOnRelOp (
  compiler: Compiler,
  offset: number,
  container: (PrefixExpressionNode | InfixExpressionNode) & { op: SyntaxToken },
  filepath: Filepath,
): CompletionList {
  const scopeKind = compiler.container.scopeKind(offset, filepath);

  if ([
    ScopeKind.REF,
    ScopeKind.TABLE,
    ScopeKind.TABLEPARTIAL,
  ].includes(scopeKind)) {
    const res = suggestNamesInScope(compiler, offset, compiler.container.element(offset, filepath), [
      SymbolKind.Table,
      SymbolKind.Schema,
      SymbolKind.Column,
    ], filepath);

    return !shouldPrependSpace(container.op, offset) ? res : prependSpace(res);
  }

  return noSuggestions();
}

function suggestMembersOfSymbol (
  compiler: Compiler,
  symbol: NodeSymbol,
  acceptedKinds: SymbolKind[],
): CompletionList {
  return addQuoteToSuggestionIfNeeded({
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

const IMPORTABLE_KINDS = new Set<string>([
  SymbolKind.Table,
  SymbolKind.Enum,
  SymbolKind.TablePartial,
  SymbolKind.TableGroup,
  SymbolKind.Note,
  SymbolKind.Schema,
]);

function suggestNamesInScope (
  compiler: Compiler,
  offset: number,
  parent: ElementDeclarationNode | ProgramNode | undefined,
  acceptedKinds: SymbolKind[],
  filepath: Filepath,
): CompletionList {
  if (parent === undefined) {
    return noSuggestions();
  }

  let curElement: SyntaxNode | undefined = parent;
  const res: CompletionList = { suggestions: [] };
  const localNames = new Set<string>();

  while (curElement) {
    const symbol = compiler.resolvedSymbol(curElement);
    if (symbol?.symbolTable) {
      const members = suggestMembersOfSymbol(compiler, symbol, acceptedKinds);
      for (const s of members.suggestions) {
        localNames.add(s.label as string);
      }
      res.suggestions.push(...members.suggestions);
    }
    curElement = curElement instanceof ElementDeclarationNode ? curElement.parent : undefined;
  }

  res.suggestions.push(
    ...suggestCrossFileSymbols(compiler, filepath, acceptedKinds, localNames),
  );

  return addQuoteToSuggestionIfNeeded(res);
}

function offsetToPosition (source: string, offset: number): { lineNumber: number; column: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { lineNumber: line, column: col };
}

function suggestCrossFileSymbols (
  compiler: Compiler,
  currentFilepath: Filepath,
  acceptedKinds: SymbolKind[],
  localNames: Set<string>,
): CompletionItem[] {
  const results: CompletionItem[] = [];
  const crossFileKinds = acceptedKinds.filter((k) => IMPORTABLE_KINDS.has(k));
  if (crossFileKinds.length === 0) return results;

  let allFiles: Filepath[];
  try {
    allFiles = compiler.layout().listAllFiles(ROOT);
  } catch {
    return results;
  }

  const ast = compiler.ast(currentFilepath);
  const source = compiler.getSource(currentFilepath) ?? '';
  const useDeclarations = ast.useDeclarations;
  const insertOffset = useDeclarations.length > 0
    ? useDeclarations[useDeclarations.length - 1].end
    : 0;
  const insertPos = offsetToPosition(source, insertOffset);

  const currentId = currentFilepath.intern();

  for (const externalFile of allFiles) {
    if (externalFile.intern() === currentId) continue;

    const externalAnalysis = compiler.analyzeFile(externalFile);
    if (externalAnalysis.getErrors().length > 0) continue;

    const relativePath = externalFile.relativeTo(currentFilepath.dirname);
    const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
    const { ast: externalAst, nodeToSymbol: externalNodeToSymbol } = externalAnalysis.getValue();
    const externalSymbolTable = externalNodeToSymbol.get(externalAst)?.symbolTable;
    if (!externalSymbolTable) continue;

    for (const [symbolId, symbol] of externalSymbolTable.entries()) {
      if (symbol instanceof ExternalSymbol) continue;

      const info = destructureIndex(symbolId).unwrap_or(undefined);
      if (!info) continue;

      const { name, kind } = info;
      if (!crossFileKinds.includes(kind)) continue;
      if (localNames.has(name)) continue;

      const useKindKeyword = kind.toLowerCase();
      const useStatement = `\nuse { ${useKindKeyword} ${name} } from '${importPath}'`;

      results.push({
        label: name,
        insertText: name,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: pickCompletionItemKind(kind),
        sortText: `zz_${name}`,
        detail: `auto-import from '${importPath}'`,
        range: undefined as any,
        additionalTextEdits: [{
          range: {
            startLineNumber: insertPos.lineNumber,
            startColumn: insertPos.column,
            endLineNumber: insertPos.lineNumber,
            endColumn: insertPos.column,
          },
          text: useStatement,
        }],
      } as CompletionItem);
    }
  }

  return results;
}

function suggestInTuple (compiler: Compiler, offset: number, tupleContainer: TupleExpressionNode, filepath: Filepath): CompletionList {
  const scopeKind = compiler.container.scopeKind(offset, filepath);
  const element = compiler.container.element(offset, filepath);

  // Check if we're inside a CallExpression - delegate to suggestInCallExpression
  const containers = [...compiler.container.stack(offset, filepath)];
  for (const c of containers) {
    if (c instanceof CallExpressionNode && c.argumentList === tupleContainer) {
      return suggestInCallExpression(compiler, offset, c, filepath);
    }
  }

  // Check if we're in a Records element header
  if (
    element instanceof ElementDeclarationNode
    && getElementKind(element).unwrap_or(undefined) === ElementKind.Records
    && !(element.name instanceof CallExpressionNode)
    && isOffsetWithinElementHeader(offset, element)
  ) {
    const tableSymbol = (element.parent ? compiler.resolvedSymbol(element.parent) : undefined) || (element.name ? compiler.nodeReferee(element.name) : undefined);
    if (tableSymbol) {
      const suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [SymbolKind.Column]);
      // If the user already typed some columns, we do not suggest "all columns" anymore
      if (!isTupleEmpty(tupleContainer)) return suggestions;
      return addSuggestAllSuggestion(suggestions);
    }
  }

  switch (scopeKind) {
    case ScopeKind.INDEXES:
      return suggestColumnNameInIndexes(compiler, offset, filepath);
    case ScopeKind.REF:
      {
        while (containers.length > 0) {
          const container = containers.pop()!;
          if (container instanceof InfixExpressionNode && container.op?.value === '.') {
            return suggestMembers(
              compiler,
              offset,
              container as InfixExpressionNode & { op: { value: '.' } },
              filepath,
            );
          }
        }
      }

      return suggestInRefField(compiler, offset, filepath);
    default:
      break;
  }

  return noSuggestions();
}

function suggestInCommaExpression (compiler: Compiler, offset: number, filepath: Filepath): CompletionList {
  const scopeKind = compiler.container.scopeKind(offset, filepath);

  // CommaExpressionNode is used in records data rows
  if (scopeKind === ScopeKind.RECORDS) {
    // In records, suggest enum values if applicable
    return suggestNamesInScope(compiler, offset, compiler.container.element(offset, filepath), [
      SymbolKind.Schema,
      SymbolKind.Enum,
      SymbolKind.EnumField,
    ], filepath);
  }

  return noSuggestions();
}

function suggestInAttribute (
  compiler: Compiler,
  offset: number,
  container: AttributeNode,
  filepath: Filepath,
): CompletionList {
  const { token } = compiler.container.token(offset, filepath);
  if ([SyntaxTokenKind.COMMA, SyntaxTokenKind.LBRACKET].includes(token?.kind as any)) {
    const res = suggestAttributeName(compiler, offset, filepath);

    return token?.kind === SyntaxTokenKind.COMMA && shouldPrependSpace(token, offset)
      ? prependSpace(res)
      : res;
  }

  if (container.name && container.name.start <= offset && container.name.end >= offset) {
    return suggestAttributeName(compiler, offset, filepath);
  }

  if (container.name instanceof IdentiferStreamNode) {
    const res = suggestAttributeValue(
      compiler,
      offset,
      extractStringFromIdentifierStream(container.name).unwrap_or(''),
      filepath,
    );

    return (token?.kind === SyntaxTokenKind.COLON && shouldPrependSpace(token, offset)) ? prependSpace(res) : res;
  }

  return noSuggestions();
}

function suggestAttributeName (compiler: Compiler, offset: number, filepath: Filepath): CompletionList {
  const element = compiler.container.element(offset, filepath);
  if (element instanceof ProgramNode) return noSuggestions();

  const scopeKind = compiler.container.scopeKind(offset, filepath);
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
  filepath: Filepath,
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
      return suggestNamesInScope(compiler, offset, compiler.container.element(offset, filepath), [
        SymbolKind.Schema,
        SymbolKind.Enum,
      ], filepath);
    default:
      break;
  }

  return noSuggestions();
}

function suggestMembers (
  compiler: Compiler,
  offset: number,
  container: InfixExpressionNode & { op: SyntaxToken },
  filepath: Filepath,
): CompletionList {
  const fragments = destructureMemberAccessExpression(container).unwrap_or([]);
  fragments.pop(); // The last fragment is not used in suggestions: v1.table.a<>
  if (fragments.some((f) => !isExpressionAVariableNode(f))) {
    return noSuggestions();
  }

  const nameStack = fragments.map((f) => extractVariableFromExpression(f).unwrap());

  return addQuoteToSuggestionIfNeeded({
    suggestions: compiler.symbol.ofName(nameStack, compiler.container.element(offset, filepath))
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
  container: FunctionApplicationNode | undefined,
  filepath: Filepath,
): CompletionList {
  const scopeKind = compiler.container.scopeKind(offset, filepath);

  switch (scopeKind) {
    case ScopeKind.TABLE:
    case ScopeKind.TABLEPARTIAL:
      return suggestInColumn(compiler, offset, container, filepath);
    case ScopeKind.PROJECT:
      return suggestInProjectField(compiler, offset, container);
    case ScopeKind.INDEXES:
      return suggestInIndex(compiler, offset, filepath);
    case ScopeKind.ENUM:
      return suggestInEnumField(compiler, offset, container, filepath);
    case ScopeKind.REF: {
      const suggestions = suggestInRefField(compiler, offset, filepath);

      return (
        compiler.container.token(offset, filepath).token?.kind === SyntaxTokenKind.COLON
        && shouldPrependSpace(compiler.container.token(offset, filepath).token, offset)
      )
        ? prependSpace(suggestions)
        : suggestions;
    }
    case ScopeKind.TABLEGROUP:
      return suggestInTableGroupField(compiler, filepath);
    default:
      return noSuggestions();
  }
}

function suggestTopLevelElementType (): CompletionList {
  return {
    suggestions: ['Table', 'TableGroup', 'Enum', 'Project', 'Ref', 'TablePartial', 'Records'].map((name) => ({
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
  container: FunctionApplicationNode | undefined,
  filepath: Filepath,
): CompletionList {
  if (!container?.callee) {
    return noSuggestions();
  }
  const containerArgId = findContainerArg(offset, container);

  if (containerArgId === 1) {
    return suggestNamesInScope(compiler, offset, compiler.container.element(offset, filepath), [
      SymbolKind.Schema,
      SymbolKind.Table,
      SymbolKind.Column,
    ], filepath);
  }

  return noSuggestions();
}

function suggestInColumn (
  compiler: Compiler,
  offset: number,
  container: FunctionApplicationNode | undefined,
  filepath: Filepath,
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
    return suggestColumnType(compiler, offset, filepath);
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

function suggestInRefField (compiler: Compiler, offset: number, filepath: Filepath): CompletionList {
  return suggestNamesInScope(compiler, offset, compiler.container.element(offset, filepath), [
    SymbolKind.Schema,
    SymbolKind.Table,
    SymbolKind.Column,
  ], filepath);
}

function suggestInElementHeader (
  compiler: Compiler,
  offset: number,
  container: ElementDeclarationNode,
  filepath: Filepath,
): CompletionList {
  const elementKind = getElementKind(container).unwrap_or(undefined);
  if (elementKind === ElementKind.Records) {
    return suggestNamesInScope(compiler, offset, container.parent, [
      SymbolKind.Schema,
      SymbolKind.Table,
    ], filepath);
  }
  return noSuggestions();
}

function suggestInCallExpression (
  compiler: Compiler,
  offset: number,
  container: CallExpressionNode,
  filepath: Filepath,
): CompletionList {
  const element = compiler.container.element(offset, filepath);

  // Determine if we're in the callee or in the arguments
  const inCallee = container.callee && isOffsetWithinSpan(offset, container.callee);
  const inArgs = container.argumentList && isOffsetWithinSpan(offset, container.argumentList);

  // Check if we're in a Records element header (top-level Records)
  if (
    element instanceof ElementDeclarationNode
    && getElementKind(element).unwrap_or(undefined) === ElementKind.Records
    && isOffsetWithinElementHeader(offset, element)
  ) {
    if (inCallee) return suggestNamesInScope(compiler, offset, element.parent, [
      SymbolKind.Schema,
      SymbolKind.Table,
    ], filepath);
    if (!inArgs) return noSuggestions();

    const callee = container.callee;
    if (!callee) return noSuggestions();

    const fragments = destructureMemberAccessExpression(callee).unwrap_or([callee]);
    const rightmostExpr = fragments[fragments.length - 1];
    const tableSymbol = rightmostExpr ? compiler.nodeReferee(rightmostExpr) : undefined;

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
  const containers = [...compiler.container.stack(offset, filepath)];
  for (const c of containers) {
    if (!inArgs) continue;
    if (!(c instanceof FunctionApplicationNode)) continue;
    if (c.callee !== container) continue;
    if (extractVariableFromExpression(container.callee).unwrap_or('').toLowerCase() !== ElementKind.Records) continue;
    const tableSymbol = compiler.resolvedSymbol(compiler.container.element(offset, filepath));
    if (!tableSymbol) return noSuggestions();
    const suggestions = suggestMembersOfSymbol(compiler, tableSymbol, [SymbolKind.Column]);
    const { argumentList } = container;
    // If the user already typed some columns, we do not suggest "all columns" anymore
    if (!argumentList || !isTupleEmpty(argumentList)) return suggestions;
    return addSuggestAllSuggestion(suggestions);
  }

  return noSuggestions();
}

function suggestInTableGroupField (compiler: Compiler, filepath: Filepath): CompletionList {
  return {
    suggestions: [
      ...addQuoteToSuggestionIfNeeded({
        suggestions: [...(compiler.resolvedSymbol(compiler.ast(filepath))?.symbolTable?.entries() ?? [])].flatMap(([index]) => {
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

function suggestInIndex (compiler: Compiler, offset: number, filepath: Filepath): CompletionList {
  return suggestColumnNameInIndexes(compiler, offset, filepath);
}

function suggestColumnType (compiler: Compiler, offset: number, filepath: Filepath): CompletionList {
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
      ...suggestNamesInScope(compiler, offset, compiler.container.element(offset, filepath), [
        SymbolKind.Enum,
        SymbolKind.Schema,
      ], filepath).suggestions,
    ],
  };
}

function suggestColumnNameInIndexes (compiler: Compiler, offset: number, filepath: Filepath): CompletionList {
  const indexesNode = compiler.container.element(offset, filepath);
  const tableNode = (indexesNode as any)?.parent;
  const tableSymbol = tableNode ? compiler.resolvedSymbol(tableNode) : undefined;
  if (!(tableSymbol instanceof TableSymbol)) {
    return noSuggestions();
  }

  const { symbolTable } = tableSymbol;

  return addQuoteToSuggestionIfNeeded({
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
