import Compiler from '@/compiler';
import { type DbmlProjectLayout } from '@/compiler/projectLayout/layout';
import { Filepath } from '@/core/types/filepath';
import { ImportKind } from '@/core/types/symbol';
import { UNHANDLED } from '@/core/types/module';
import {
  UseDeclarationNode,
  UseSpecifierListNode,
  UseSpecifierNode,
  WildcardNode,
} from '@/core/types/nodes';
import { SymbolKind, UseSymbol } from '@/core/types/symbol';
import { SyntaxToken } from '@/core/types/tokens';
import { extractVariableFromExpression } from '@/core/utils/expression';
import { isOffsetWithinSpan } from '@/core/utils/span';
import {
  noSuggestions,
  pickCompletionItemKind,
  prependSpace,
  shouldPrependSpace,
} from '@/services/suggestions/utils';
import {
  type CompletionItem,
  CompletionItemInsertTextRule,
  CompletionItemKind,
  type CompletionList,
  type TextModel,
} from '@/services/types';
import { getEditorRange } from '../utils';

export interface SuggestUseCompletionOptions {
  // Maximum directory depth for specifier-mode file listing (default: 2)
  fileListDepth?: number;
}

// Use-declaration completions. Returns null if cursor not inside a use statement.
export function suggestUseCompletion (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  bOcToken: SyntaxToken | undefined,
  model: TextModel,
  options: SuggestUseCompletionOptions = {},
): CompletionList | null {
  const ast = compiler.parse.ast(filepath);
  for (const node of ast.body) {
    if (
      node instanceof UseDeclarationNode
      && offset >= node.start
      && offset <= node.fullEnd
    ) {
      return suggestInUseDeclaration(
        compiler,
        filepath,
        offset,
        node,
        model,
        bOcToken,
        options,
      );
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
  options: SuggestUseCompletionOptions,
): CompletionList {
  // Inside importPath string -> filepath completions
  if (useDecl.importPath && isOffsetWithinSpan(offset, useDecl.importPath)) {
    return suggestUseFilepath(
      compiler,
      filepath,
      useDecl.importPath,
      model,
      useDecl,
      options,
    );
  }

  // After closing quote of importPath -> no suggestions
  if (useDecl.importPath && offset >= useDecl.importPath.end) {
    return noSuggestions();
  }

  // After `from` but no importPath yet -> filepath completions
  if (useDecl.fromKeyword && offset > useDecl.fromKeyword.end) {
    return suggestUseFilepath(
      compiler,
      filepath,
      undefined,
      model,
      useDecl,
      options,
    );
  }

  // Inside specifier list
  if (useDecl.specifiers instanceof UseSpecifierListNode) {
    // No openBrace -> cursor before specifier list (e.g. `use |`)
    if (!useDecl.specifiers.openBrace) {
      const res = suggestUseSpecifierStart();
      return shouldPrependSpace(useDecl.useKeyword, offset)
        ? prependSpace(res)
        : res;
    }
    return suggestInUseSpecifierList(
      compiler,
      filepath,
      offset,
      useDecl.specifiers,
      useDecl.importPath,
      bOcToken,
    );
  }

  // After `*` wildcard -> nothing to suggest
  if (useDecl.specifiers instanceof WildcardNode) {
    return noSuggestions();
  }

  // After `use`/`reuse`, before specifiers
  const res = suggestUseSpecifierStart();
  return shouldPrependSpace(useDecl.useKeyword, offset)
    ? prependSpace(res)
    : res;
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
    const inSpan =
      !Number.isNaN(spec.start) && offset >= spec.start && offset <= spec.end;
    const bOcIsSpec =
      bOcToken === spec.importKind || bOcToken === spec.asKeyword;
    if (inSpan || bOcIsSpec) {
      if (spec.importKind && offset > spec.importKind.end) {
        const symbolKind = spec.getSymbolKind();
        if (symbolKind !== undefined && symbolKind !== SymbolKind.Schema) {
          return suggestUseElementNames(
            compiler,
            filepath,
            importPath,
            symbolKind,
          );
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
  const targetFilepath = compiler.layout.resolveFileSpecifier(
    currentFilepath,
    importPath.value,
  );
  if (!targetFilepath) return noSuggestions();

  const usable = compiler.usableMembers(targetFilepath).getFiltered(UNHANDLED);
  if (!usable) return noSuggestions();

  const names = new Set<string>();

  // Collect from schema members (which resolves reuse chains)
  for (const schema of usable.schemaMembers) {
    const schemaMembers =
      compiler.symbolMembers(schema).getFiltered(UNHANDLED) ?? [];
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
    suggestions: [...names].map((name) => ({
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
  { fileListDepth = 2 }: SuggestUseCompletionOptions,
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

  const isPathBrowse =
    existingIncompleteImportPath.startsWith('/')
    || existingIncompleteImportPath.startsWith('./')
    || existingIncompleteImportPath.startsWith('../');
  if (isPathBrowse) {
    for (const { label, entry } of listDirectoryEntries(
      compiler,
      currentFilepath,
      existingIncompleteImportPath,
    )) {
      const isDir = compiler.layout.isDirectory(entry);
      const fileSpecifier = isDir
        ? undefined
        : compiler.layout.getFileSpecifierInfo(currentFilepath, entry);
      if (!isDir && fileSpecifier === undefined) continue;

      if (
        !isDir
        && doesFileProvideAllSpecifiers(compiler, entry, requiredSymbols)
      )
        bestMatches.add(label);

      const insertValue = fileSpecifier?.specifier ?? label;
      items.set(label, {
        label: fileSpecifier?.label ?? label,
        detail: fileSpecifier?.detail,
        insertText: shouldInsertQuoteToImportPath
          ? `'${insertValue}'`
          : insertValue,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: isDir ? CompletionItemKind.Folder : CompletionItemKind.File,
        sortText: `${isDir ? '2' : '3'}${label}`,
        range,
      });
    }
  } else {
    // Specifier mode: collect all files by traversing directories up to fileListDepth levels
    const allFilepaths = listFilesRecursive(compiler.layout, Filepath.from('/'), fileListDepth);

    for (const filepath of allFilepaths) {
      if (filepath.equals(currentFilepath)) continue;

      const fileSpecifier = compiler.layout.getFileSpecifierInfo(
        currentFilepath,
        filepath,
      );
      if (
        fileSpecifier === undefined
        || !fileSpecifier.specifier.startsWith(existingIncompleteImportPath)
      )
        continue;

      const { specifier, label: specifierLabel, detail } = fileSpecifier;
      if (doesFileProvideAllSpecifiers(compiler, filepath, requiredSymbols))
        bestMatches.add(specifier);
      if (items.has(specifier)) continue;

      const insertText = shouldInsertQuoteToImportPath
        ? `'${specifier}'`
        : specifier;
      items.set(specifier, {
        label: specifierLabel ?? specifier,
        detail,
        insertText,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.File,
        sortText: `3${specifier}`,
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

// List directory entries matching the user's partial path
function listDirectoryEntries (
  compiler: Compiler,
  currentFilepath: Filepath,
  partialPath: string,
): Array<{ label: string; entry: Filepath }> {
  // Resolve relative prefix (./foo, ../bar) to absolute
  let resolvedPrefix: string;
  if (partialPath.startsWith('/')) {
    resolvedPrefix = partialPath;
  } else {
    resolvedPrefix = Filepath.resolve(
      currentFilepath.dirname,
      partialPath,
    ).fsPath;
    if (partialPath.endsWith('/') && !resolvedPrefix.endsWith('/'))
      resolvedPrefix += '/';
  }

  const dirPath = resolvedPrefix.endsWith('/')
    ? resolvedPrefix
    : Filepath.from(resolvedPrefix).dirname;

  const results: Array<{ label: string; entry: Filepath }> = [];

  for (const entry of compiler.layout.listDirectory(Filepath.from(dirPath))) {
    if (entry.equals(currentFilepath)) continue;
    if (!entry.fsPath.startsWith(resolvedPrefix)) continue;

    // Convert absolute path back to the user's relative partial path
    const basename = entry.fsPath.slice(resolvedPrefix.length);
    const isDirectory = compiler.layout.isDirectory(entry);
    const label = isDirectory
      ? `${partialPath}${basename}/`
      : `${partialPath}${basename}`;

    results.push({ label, entry });
  }

  return results;
}

// Collect all files reachable from dirPath up to `depth` directory levels.
function listFilesRecursive (
  layout: DbmlProjectLayout,
  dirPath: Filepath,
  depth: number,
): Filepath[] {
  if (depth <= 0) return [];
  const result: Filepath[] = [];
  for (const entry of layout.listDirectory(dirPath)) {
    if (layout.isFile(entry)) {
      result.push(entry);
    } else if (layout.isDirectory(entry)) {
      result.push(...listFilesRecursive(layout, entry, depth - 1));
    }
  }
  return result;
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
function doesFileProvideAllSpecifiers (
  compiler: Compiler,
  filepath: Filepath,
  required: Array<{ name: string; kind: SymbolKind }>,
): boolean {
  if (required.length === 0) return false;
  const usable = compiler.usableMembers(filepath).getFiltered(UNHANDLED);
  if (!usable) return false;
  return required.every(({ name, kind }) =>
    usable.nonSchemaMembers.some((m) => m.kind === kind && m.name === name),
  );
}
