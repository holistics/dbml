import Compiler from '@/compiler';
import {
  Filepath, resolveImportFilepath,
} from '@/core/types/filepath';
import {
  ImportKind,
} from '@/core/types/symbol';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  UseDeclarationNode, UseSpecifierListNode, UseSpecifierNode, WildcardNode,
} from '@/core/types/nodes';
import {
  SymbolKind,
} from '@/core/types/symbol';
import {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  isOffsetWithinSpan,
} from '@/core/utils/span';
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
import {
  getEditorRange,
} from '../utils';
import {
  uniqBy,
} from 'lodash-es';
import {
  DBML_EXT,
} from '@/constants';

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
    if (node instanceof UseDeclarationNode && node.containsEq(offset)) {
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

  // After `from` -> filepath completions
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
    suggestions: Object.values(ImportKind).map((k) => ({
      label: k,
      insertText: `${k} `,
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
  const targetFilepath = resolveImportFilepath(currentFilepath, importPath.value);
  if (!targetFilepath) return noSuggestions();

  const usable = compiler.usableMembers(targetFilepath).getFiltered(UNHANDLED);
  if (!usable) return noSuggestions();

  const names: string[] = [];

  for (const member of usable.nonSchemaMembers) {
    if (member.kind !== symbolKind) continue;
    const name = member.name;
    if (name) names.push(name);
  }

  for (const schema of usable.schemaMembers) {
    if (schema.isPublicSchema()) continue;
    const schemaName = schema.name;
    if (!schemaName) continue;
    const schemaMembers = compiler.symbolMembers(schema).getFiltered(UNHANDLED) ?? [];
    for (const member of schemaMembers) {
      if (member.kind !== symbolKind) continue;
      const memberName = member.name;
      if (memberName) names.push(`${schemaName}.${memberName}`);
    }
  }

  return {
    suggestions: names.map((name) => ({
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
        insertText: "* from '${1:path}'",
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
        kind: CompletionItemKind.Snippet,
        range: undefined as any,
      },
      {
        label: '{ } from',
        detail: 'import named',
        insertText: "{ ${1:table} ${2:name} } from '${3:path}'",
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
        kind: CompletionItemKind.Snippet,
        range: undefined as any,
      },
    ],
  };
}

// Suggest direct-child subpaths. Files matching all specifiers sort first.
function suggestUseFilepath (
  compiler: Compiler,
  currentFilepath: Filepath,
  importPath: SyntaxToken | undefined,
  model: TextModel,
  useDeclaration: UseDeclarationNode,
): CompletionList {
  const currentDir = currentFilepath.dirname;

  // Default to `./` so direct-children slicing lines up with
  // `asImportPath`'s output when the user hasn't started the string yet.
  const existingIncompleteImportPath = importPath ? importPath.value : './';
  // If the import path hasn't been typed out, we need to quote it
  const shouldInsertQuoteToImportPath = importPath === undefined;

  // Target range between quotes so replacement preserves them.
  let existingImportPathRange: any;
  if (importPath) {
    const tokenRange = getEditorRange(model, importPath);
    existingImportPathRange = {
      startLineNumber: tokenRange.startLineNumber,
      startColumn: tokenRange.startColumn + 1,
      endLineNumber: tokenRange.endLineNumber,
      endColumn: tokenRange.endColumn - 1,
    };
  }

  const pathToCompletionItem = new Map<string, CompletionItem>();
  // Folders containing a matching file sort first.
  const childContainsMatch = new Map<string, boolean>();

  // Scan all reachable files
  const allFilepaths = uniqBy(compiler.layout.getEntryPoints().flatMap((f) => [
    ...compiler.reachableFiles(f),
  ]), (p) => p.intern());
  for (const filepath of allFilepaths) {
    if (filepath.equals(currentFilepath)) continue; // Do not suggest current filepath

    let relativePathToCurrentDir = filepath.relativeTo(currentDir);
    if (relativePathToCurrentDir.endsWith(DBML_EXT)) relativePathToCurrentDir = relativePathToCurrentDir.slice(0, -DBML_EXT.length); // slice off `.dbml` postfix to allow conciseness
    if (!relativePathToCurrentDir.startsWith('.')) relativePathToCurrentDir = `./${relativePathToCurrentDir}`;

    if (existingIncompleteImportPath && !relativePathToCurrentDir.startsWith(existingIncompleteImportPath)) continue;

    // Take next segment only  -- deeper entries collapse onto their folder.
    const tail = relativePathToCurrentDir.slice(existingIncompleteImportPath.length);
    const childLabel = `${existingIncompleteImportPath}${tail.split('/')[0]}`;

    // Ask layout so symlinks resolve correctly.
    const childAbsolute = Filepath.resolve(currentDir, childLabel);
    const isDir = compiler.layout.isDirectory(childAbsolute);

    const requiredSymbols = extractRequiredSymbols(useDeclaration);
    const fileMatches = fileProvidesAllSpecifiers(compiler, filepath, requiredSymbols);
    if (fileMatches) childContainsMatch.set(childLabel, true);

    if (pathToCompletionItem.has(childLabel)) continue;

    const insertText = shouldInsertQuoteToImportPath ? `'${childLabel}'` : childLabel;
    pathToCompletionItem.set(childLabel, {
      label: childLabel,
      insertText,
      insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
      kind: isDir ? CompletionItemKind.Folder : CompletionItemKind.File,
      // Sort: best-match file (0) -> best-match folder (1) -> folder (2) -> file (3).
      sortText: `${isDir ? '2' : '3'}${childLabel}`,
      range: existingImportPathRange,
    });
  }

  for (const [
    label,
    item,
  ] of pathToCompletionItem) {
    if (!childContainsMatch.get(label)) continue;
    item.sortText = `${item.kind === CompletionItemKind.File ? '0' : '1'}${label}`;
    item.detail = 'best match';
  }

  return {
    suggestions: [
      ...pathToCompletionItem.values(),
    ],
  };
}

// Extract { name, kind } pairs from the use declaration's specifier list.
function extractRequiredSymbols (useDeclaration: UseDeclarationNode): Array<{ name: string;
  kind: SymbolKind; }> {
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
