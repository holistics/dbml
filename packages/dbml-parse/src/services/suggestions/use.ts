import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { ImportKind } from '@/core/types/symbol';
import { UNHANDLED } from '@/core/types/module';
import {
  UseDeclarationNode, UseSpecifierListNode, UseSpecifierNode, WildcardNode,
} from '@/core/types/nodes';
import { SymbolKind, UseSymbol } from '@/core/types/symbol';
import { SyntaxToken } from '@/core/types/tokens';
import { extractVariableFromExpression } from '@/core/utils/expression';
import { isOffsetWithinSpan } from '@/core/utils/span';
import {
  noSuggestions, pickCompletionItemKind, prependSpace, shouldPrependSpace,
} from '@/services/suggestions/utils';
import {
  type CompletionItem,
  CompletionItemInsertTextRule,
  CompletionItemKind,
  type CompletionList,
  type TextModel,
} from '@/services/types';
import { getEditorRange } from '../utils';
import { uniqBy } from 'lodash-es';

// Use-declaration completions. Returns null if cursor not inside a use statement.
export function suggestUseCompletion (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  bOcToken: SyntaxToken | undefined,
  model: TextModel,
): CompletionList | null {
  const ast = compiler.parse.ast(filepath);
  for (const node of ast.body) {
    if (node instanceof UseDeclarationNode && offset >= node.start && offset <= node.fullEnd) {
      return suggestInUseDeclaration(compiler, filepath, offset, node, model, bOcToken);
    }
  }
  return null;
}

function suggestInUseDeclaration (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  useDecl: UseDeclarationNode,
  model: TextModel,
  bOcToken: SyntaxToken | undefined,
): CompletionList {
  // Inside importPath string -> filepath completions
  if (useDecl.importPath && isOffsetWithinSpan(offset, useDecl.importPath)) {
    return suggestUseFilepath(compiler, filepath, useDecl.importPath, model, useDecl);
  }

  // After closing quote of importPath -> no suggestions
  if (useDecl.importPath && offset >= useDecl.importPath.end) {
    return noSuggestions();
  }

  // After `from` but no importPath yet -> filepath completions
  if (useDecl.fromKeyword && offset > useDecl.fromKeyword.end) {
    return suggestUseFilepath(compiler, filepath, undefined, model, useDecl);
  }

  // Inside specifier list
  if (useDecl.specifiers instanceof UseSpecifierListNode) {
    // No openBrace -> cursor before specifier list (e.g. `use |`)
    if (!useDecl.specifiers.openBrace) {
      const res = suggestUseSpecifierStart();
      return shouldPrependSpace(useDecl.useKeyword, offset) ? prependSpace(res) : res;
    }
    return suggestInUseSpecifierList(compiler, filepath, offset, useDecl.specifiers, useDecl.importPath, bOcToken);
  }

  // After `*` wildcard -> nothing to suggest
  if (useDecl.specifiers instanceof WildcardNode) {
    return noSuggestions();
  }

  // After `use`/`reuse`, before specifiers
  const res = suggestUseSpecifierStart();
  return shouldPrependSpace(useDecl.useKeyword, offset) ? prependSpace(res) : res;
}

function suggestInUseSpecifierList (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  specList: UseSpecifierListNode,
  importPath: SyntaxToken | undefined,
  bOcToken: SyntaxToken | undefined,
): CompletionList {
  for (const spec of specList.specifiers) {
    const inSpan = !Number.isNaN(spec.start) && offset >= spec.start && offset <= spec.end;
    const bOcIsSpec = bOcToken === spec.importKind || bOcToken === spec.asKeyword;
    if (inSpan || bOcIsSpec) {
      if (spec.importKind && offset > spec.importKind.end) {
        const symbolKind = spec.getSymbolKind();
        if (symbolKind !== undefined && symbolKind !== SymbolKind.Schema) {
          return suggestUseElementNames(compiler, filepath, importPath, symbolKind);
        }
      }
      return suggestImportKinds();
    }
  }

  return suggestImportKinds();
}

function suggestImportKinds (): CompletionList {
  return {
    suggestions: Object.keys(ImportKind).map((k) => ({
      label: k.toLowerCase(),
      insertText: `${k.toLowerCase()} `,
      insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
      kind: CompletionItemKind.Keyword,
      range: undefined as any,
    })),
  };
}

function suggestUseElementNames (
  compiler: Compiler,
  currentFilepath: Filepath,
  importPath: SyntaxToken | undefined,
  symbolKind: SymbolKind,
): CompletionList {
  if (!importPath) return noSuggestions();
  const targetFilepath = compiler.layout.resolveFileSpecifier(currentFilepath, importPath.value);
  if (!targetFilepath) return noSuggestions();

  const usable = compiler.usableMembers(targetFilepath).getFiltered(UNHANDLED);
  if (!usable) return noSuggestions();

  const names = new Set<string>();

  // Collect from schema members (which resolves reuse chains)
  for (const schema of usable.schemaMembers) {
    const schemaMembers = compiler.symbolMembers(schema).getFiltered(UNHANDLED) ?? [];
    for (const member of schemaMembers) {
      if (member.kind !== symbolKind) continue;
      // Only suggest symbols that can be imported (reused, not use-only)
      if (member instanceof UseSymbol && !member.canBeImported) continue;
      const memberName = member.name;
      if (!memberName) continue;
      if (schema.isPublicSchema()) {
        names.add(memberName);
      } else {
        names.add(`${schema.name}.${memberName}`);
      }
    }
  }

  return {
    suggestions: [
      ...names,
    ].map((name) => ({
      label: name,
      insertText: name,
      insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
      kind: pickCompletionItemKind(symbolKind),
      range: undefined as any,
    })),
  };
}

function suggestUseSpecifierStart (): CompletionList {
  return {
    suggestions: [
      {
        label: '* from',
        detail: 'import all',
        insertText: "* from '${1:./path}'",
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
        kind: CompletionItemKind.Snippet,
        range: undefined as any,
      },
      {
        label: '{ } from',
        detail: 'import named',
        insertText: "{ ${1:type} ${2:name} } from '${3:./path}'",
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
        kind: CompletionItemKind.Snippet,
        range: undefined as any,
      },
    ],
  };
}

// Suggest import paths. Two modes:
// - Filepath browse mode (user types /, ./, ../): browse via listDirectory, insert specifier on file select
// - Specifier mode (anything else, e.g. @id): list reachable files, map to specifier, filter by prefix
function suggestUseFilepath (
  compiler: Compiler,
  currentFilepath: Filepath,
  importPath: SyntaxToken | undefined,
  model: TextModel,
  useDeclaration: UseDeclarationNode,
): CompletionList {
  // Default to empty string so all specifiers/paths pass the prefix filter
  // when the user hasn't started the string yet.
  const existingIncompleteImportPath = importPath ? importPath.value : '';
  // If the import path hasn't been typed out, we need to quote it
  const shouldInsertQuoteToImportPath = importPath === undefined;

  let range: any;
  if (importPath) {
    const tokenRange = getEditorRange(model, importPath);
    range = {
      startLineNumber: tokenRange.startLineNumber,
      startColumn: tokenRange.startColumn + 1,
      endLineNumber: tokenRange.endLineNumber,
      endColumn: tokenRange.endColumn - 1,
    };
  }

  const requiredSymbols = extractRequiredSymbols(useDeclaration);
  const items = new Map<string, CompletionItem>();
  const bestMatches = new Set<string>();

  // Filepath browse mode: user types a path (/, ./, ../) to browse the filesystem
  const isPathBrowse = existingIncompleteImportPath.startsWith('/') || existingIncompleteImportPath.startsWith('./') || existingIncompleteImportPath.startsWith('../');
  if (isPathBrowse) {
    // Resolve relative prefixes to absolute for listDirectory
    let resolvedPrefix: string;
    if (existingIncompleteImportPath.startsWith('/')) {
      resolvedPrefix = existingIncompleteImportPath;
    } else {
      const resolved = Filepath.resolve(currentFilepath.dirname, existingIncompleteImportPath).fsPath;
      resolvedPrefix = existingIncompleteImportPath.endsWith('/') && !resolved.endsWith('/') ? resolved + '/' : resolved;
    }
    const lastSlash = resolvedPrefix.lastIndexOf('/');
    const dirPath = resolvedPrefix.slice(0, lastSlash + 1) || '/';

    for (const entry of compiler.layout.listDirectory(Filepath.from(dirPath))) {
      if (entry.equals(currentFilepath)) continue;
      const entryPath = entry.fsPath;
      if (!entryPath.startsWith(resolvedPrefix)) continue;

      // For relative browse (./,../), show relative labels; for absolute (/), show absolute
      const displayPath = existingIncompleteImportPath + entryPath.slice(resolvedPrefix.length);

      const isDir = compiler.layout.isDirectory(entry);
      if (isDir) {
        const label = `${displayPath}/`;
        const insertText = shouldInsertQuoteToImportPath ? `'${label}'` : label;
        items.set(label, {
          label,
          insertText,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.Folder,
          sortText: `2${label}`,
          range,
        });
      } else {
        const specifier = compiler.layout.getSpecifierForFile(currentFilepath, entry);
        if (specifier === undefined) continue;

        const label = displayPath;
        if (fileProvidesAllSpecifiers(compiler, entry, requiredSymbols)) bestMatches.add(label);

        const insertText = shouldInsertQuoteToImportPath ? `'${specifier}'` : specifier;
        items.set(label, {
          label,
          detail: specifier,
          insertText,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.File,
          sortText: `3${label}`,
          range,
        });
      }
    }
  } else {
    // Specifier mode: list all reachable files, map to specifier, filter by prefix
    const allFilepaths = uniqBy(compiler.layout.getEntrypoints().flatMap((f) => [
      ...compiler.reachableFiles(f),
    ]), (p) => p.intern());

    for (const filepath of allFilepaths) {
      if (filepath.equals(currentFilepath)) continue;

      const specifier = compiler.layout.getSpecifierForFile(currentFilepath, filepath);
      if (specifier === undefined || !specifier.startsWith(existingIncompleteImportPath)) continue;

      // Collapse to next segment (only when user has started typing a prefix)
      let childLabel = specifier;
      let isDir = false;
      if (existingIncompleteImportPath) {
        const tail = specifier.slice(existingIncompleteImportPath.length);
        childLabel = `${existingIncompleteImportPath}${tail.split('/')[0]}`;
        isDir = childLabel !== specifier;
      }

      if (fileProvidesAllSpecifiers(compiler, filepath, requiredSymbols)) bestMatches.add(childLabel);
      if (items.has(childLabel)) continue;

      const insertText = shouldInsertQuoteToImportPath ? `'${childLabel}'` : childLabel;
      items.set(childLabel, {
        label: childLabel,
        insertText,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: isDir ? CompletionItemKind.Folder : CompletionItemKind.File,
        sortText: `${isDir ? '2' : '3'}${childLabel}`,
        range,
      });
    }
  }

  // Promote best matches to top
  for (const [label, item] of items) {
    if (!bestMatches.has(label)) continue;
    item.sortText = `${item.kind === CompletionItemKind.File ? '0' : '1'}${label}`;
    item.detail = item.detail ? `${item.detail} · best match` : 'best match';
  }

  return { suggestions: [...items.values()] };
}

// Extract { name, kind } pairs from the use declaration's specifier list.
function extractRequiredSymbols (useDeclaration: UseDeclarationNode): Array<{
  name: string;
  kind: SymbolKind;
}> {
  const specifiers = useDeclaration.specifiers;
  if (!(specifiers instanceof UseSpecifierListNode)) return [];
  return specifiers.specifiers.flatMap((spec: UseSpecifierNode) => {
    const name = extractVariableFromExpression(spec.name);
    const kind = spec.importKind?.value.toLowerCase() as SymbolKind | undefined;
    if (!name || !kind) return [];
    return [
      {
        name,
        kind,
      },
    ];
  });
}

// True when file provides every required specifier by name + kind.
function fileProvidesAllSpecifiers (
  compiler: Compiler,
  filepath: Filepath,
  required: Array<{ name: string;
    kind: SymbolKind; }>,
): boolean {
  if (required.length === 0) return false;
  const usable = compiler.usableMembers(filepath).getFiltered(UNHANDLED);
  if (!usable) return false;
  return required.every(({
    name, kind,
  }) => usable.nonSchemaMembers.some((m) => m.kind === kind && m.name === name));
}
