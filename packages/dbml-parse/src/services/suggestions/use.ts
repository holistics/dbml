import Compiler from '@/compiler';
import {
  Filepath, resolveImportFilepath,
} from '@/core/types/filepath';
import {
  ImportKind,
} from '@/core/types/keywords';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  UseDeclarationNode, UseSpecifierListNode, WildcardNode,
} from '@/core/types/nodes';
import {
  convertImportKindToSymbolKind,
} from '@/core/types/symbol';
import {
  SyntaxToken,
} from '@/core/types/tokens';
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

function isTokenInUseDecl (token: SyntaxToken, useDecl: UseDeclarationNode): boolean {
  if (token === useDecl.useKeyword) return true;
  if (token === useDecl.fromKeyword) return true;
  if (token === useDecl.importPath) return true;
  const specs = useDecl.specifiers;
  if (specs instanceof WildcardNode) return token === specs.token;
  if (specs instanceof UseSpecifierListNode) {
    if (token === specs.openBrace || token === specs.closeBrace) return true;
    for (const spec of specs.specifiers) {
      if (token === spec.importKind || token === spec.asKeyword) return true;
    }
  }
  return false;
}

function isOffsetInUseDeclaration (
  offset: number,
  useDecl: UseDeclarationNode,
  bOcToken: SyntaxToken | undefined,
): boolean {
  if (!Number.isNaN(useDecl.start) && offset >= useDecl.start && offset <= useDecl.end) return true;
  return !!bOcToken && isTokenInUseDecl(bOcToken, useDecl);
}

// Entry point for use-declaration completions. Returns a CompletionList if the
// cursor is inside any UseDeclarationNode of the file, or null to let the
// generic provider handle it. Mirrors `suggestRecordRowSnippet`.
export function suggestUseCompletion (
  compiler: Compiler,
  filepath: Filepath,
  offset: number,
  bOcToken: SyntaxToken | undefined,
  model: TextModel,
): CompletionList | null {
  const ast = compiler.parse.ast(filepath);
  for (const node of ast.body) {
    if (node instanceof UseDeclarationNode && isOffsetInUseDeclaration(offset, node, bOcToken)) {
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
  // Cursor inside the importPath string -> filepath completions with replacement
  if (useDecl.importPath && isOffsetWithinSpan(offset, useDecl.importPath)) {
    return suggestUseFilepath(compiler, filepath, useDecl.importPath, model, useDecl);
  }

  // Cursor after `from` keyword -> filepath completions (fresh insert)
  if (useDecl.fromKeyword && offset > useDecl.fromKeyword.end) {
    return suggestUseFilepath(compiler, filepath, undefined, model, useDecl);
  }

  // Cursor inside specifier list
  if (useDecl.specifiers instanceof UseSpecifierListNode) {
    // Recovery node with no openBrace: cursor is before/at the specifier list (e.g. `use |`)
    if (!useDecl.specifiers.openBrace) {
      const res = suggestUseSpecifierStart();
      return shouldPrependSpace(useDecl.useKeyword, offset) ? prependSpace(res) : res;
    }
    return suggestInUseSpecifierList(compiler, filepath, offset, useDecl.specifiers, useDecl.importPath, bOcToken);
  }

  // After `*` wildcard — nothing more to suggest
  if (useDecl.specifiers instanceof WildcardNode) {
    return noSuggestions();
  }

  // After `use`/`reuse` keyword, before specifiers → start snippets
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
        const importKind = spec.getImportKind();
        if (importKind !== undefined && importKind !== ImportKind.Schema) {
          return suggestUseElementNames(compiler, filepath, importPath, importKind);
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
  importKind: ImportKind,
): CompletionList {
  if (!importPath) return noSuggestions();
  const targetFilepath = resolveImportFilepath(currentFilepath, importPath.value);
  if (!targetFilepath) return noSuggestions();

  const symbolKind = convertImportKindToSymbolKind(importKind);
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

// Suggest all subpaths that are direct children of the existing (incomplete) filepath
// e.g.
// use * from './'
//              ^
//            suggest files under `./`
//
// When the use statement already has specifiers (e.g.
// `use { table users, table orders } from '<here>'`), files that export every
// listed symbol are surfaced first so the user doesn't have to hunt for the
// right source file.
function suggestUseFilepath (
  compiler: Compiler,
  currentFilepath: Filepath,
  importPath: SyntaxToken | undefined,
  model: TextModel,
  useDecl: UseDeclarationNode,
): CompletionList {
  const currentDir = currentFilepath.dirname;

  // Default to `./` so direct-children slicing lines up with
  // `asImportPath`'s output when the user hasn't started the string yet.
  const existingIncompleteImportPath = importPath ? importPath.value : './';
  // If the import path hasn't been typed out, that means we have to quote the import path
  // e.g.
  // use * from
  //            ^
  //         import path hasn't been typed out
  const shouldInsertQuoteToImportPath = importPath === undefined;

  // When the importPath token exists, target the range *between* its quotes
  // so the replacement leaves the surrounding quotes intact. The caller
  // already guaranteed this runs against a string-literal token, so we can
  // assume both quotes are present and skip them directly.
  let existingImportPathRange: any = undefined;
  if (importPath) {
    const tokenRange = getEditorRange(model, importPath);
    existingImportPathRange = {
      startLineNumber: tokenRange.startLineNumber,
      startColumn: tokenRange.startColumn + 1,
      endLineNumber: tokenRange.endLineNumber,
      endColumn: tokenRange.endColumn - 1,
    };
  }

  const requiredSymbols = extractRequiredSymbols(useDecl);

  const pathToCompletionItem = new Map<string, CompletionItem>();
  // Track which synthetic folder entries contain at least one matching file
  // so they can sort ahead of unrelated folders.
  const childContainsMatch = new Map<string, boolean>();

  // Scan all filepaths
  const allFilepaths = uniqBy(compiler.layout.getEntryPoints().flatMap((f) => [
    ...compiler.reachableFiles(f),
  ]), (p) => p.intern());
  for (const filepath of allFilepaths) {
    if (filepath.equals(currentFilepath)) continue; // Do not suggest current filepath

    let relativePathToCurrentDir = filepath.relativeTo(currentDir);
    if (relativePathToCurrentDir.endsWith(DBML_EXT)) relativePathToCurrentDir = relativePathToCurrentDir.slice(0, -DBML_EXT.length); // slice off `.dbml` postfix to allow conciseness
    if (!relativePathToCurrentDir.startsWith('.')) relativePathToCurrentDir = `./${relativePathToCurrentDir}`;

    if (existingIncompleteImportPath && !relativePathToCurrentDir.startsWith(existingIncompleteImportPath)) continue;

    // Only suggested direct children — take just the next segment after the
    // already-typed prefix so deeper entries collapse onto their folder.
    const tail = relativePathToCurrentDir.slice(existingIncompleteImportPath.length);
    const childLabel = `${existingIncompleteImportPath}${tail.split('/')[0]}`;

    // Ask the layout instead of inspecting the path shape so symlinks etc.
    // resolve correctly under node-backed layouts.
    const childAbsolute = Filepath.resolve(currentDir, childLabel);
    const isDir = compiler.layout.isDirectory(childAbsolute);

    const fileMatches = fileProvidesAllSpecifiers(compiler, filepath, requiredSymbols);
    if (fileMatches) childContainsMatch.set(childLabel, true);

    if (pathToCompletionItem.has(childLabel)) continue;

    const insertText = shouldInsertQuoteToImportPath ? `'${childLabel}'` : childLabel;
    pathToCompletionItem.set(childLabel, {
      label: childLabel,
      insertText,
      insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
      kind: isDir ? CompletionItemKind.Folder : CompletionItemKind.File,
      // Sort tiers: best-match file (0) → best-match folder (1) → folder (2) → file (3).
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

// Pull out the symbol name + kind each specifier is asking for so we can tell
// which candidate files actually expose them.
function extractRequiredSymbols (useDecl: UseDeclarationNode): Array<{ name: string;
  kind: ImportKind; }> {
  if (!(useDecl.specifiers instanceof UseSpecifierListNode)) return [];
  const required: Array<{ name: string;
    kind: ImportKind; }> = [];
  for (const spec of useDecl.specifiers.specifiers) {
    const kind = spec.getImportKind();
    if (kind === undefined || kind === ImportKind.Schema) continue;
    const nameNode = spec.name;
    if (!nameNode) continue;
    const nameValue = (nameNode as any).variable?.value ?? (nameNode as any).value;
    if (typeof nameValue !== 'string' || !nameValue) continue;
    // Strip any schema-qualifier (`auth.users` → `users`) — we check for the
    // bare member in the target file's usable members.
    const bareName = nameValue.includes('.') ? nameValue.split('.').pop()! : nameValue;
    required.push({
      name: bareName,
      kind,
    });
  }
  return required;
}

// True when the file declares (or re-exports) every required specifier by
// name + kind. An empty requirement list matches nothing specifically, so
// fileMatches stays false and no file is boosted.
function fileProvidesAllSpecifiers (
  compiler: Compiler,
  filepath: Filepath,
  required: Array<{ name: string;
    kind: ImportKind; }>,
): boolean {
  if (required.length === 0) return false;
  const usable = compiler.usableMembers(filepath).getFiltered(UNHANDLED);
  if (!usable) return false;
  return required.every(({
    name, kind,
  }) => {
    const symbolKind = convertImportKindToSymbolKind(kind);
    return usable.nonSchemaMembers.some((m) => m.kind === symbolKind && m.name === name);
  });
}
