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
  // Cursor inside the importPath string → filepath completions with replacement
  if (useDecl.importPath && isOffsetWithinSpan(offset, useDecl.importPath)) {
    return suggestUseFilepath(compiler, filepath, useDecl.importPath, model);
  }

  // Cursor after `from` keyword → filepath completions (fresh insert)
  if (useDecl.fromKeyword && offset > useDecl.fromKeyword.end) {
    return suggestUseFilepath(compiler, filepath, undefined, model);
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

function suggestUseFilepath (
  compiler: Compiler,
  currentFilepath: Filepath,
  importPath: SyntaxToken | undefined,
  model: TextModel,
): CompletionList {
  const currentDir = currentFilepath.dirname;

  // When the cursor is inside an existing `'…'` importPath literal, the
  // suggestion should replace exactly the *content between the quotes* and
  // never re-insert the quotes themselves — otherwise accepting a
  // completion against `'./'` ends up producing `'././b'` (the old
  // behaviour stacked the already-typed `./` with the full quoted insert).
  //
  // We also only show entries whose rel path starts with whatever the user
  // has typed so far, so `./foo/` narrows the list to that subdirectory.
  const existingRaw = importPath ? stripQuotes(sourceText(model, importPath)) : '';
  const prefix = existingRaw;
  const insertQuoted = importPath === undefined;

  const range = importPath ? computeImportPathRange(model, importPath) : undefined as any;
  const byLabel = new Map<string, CompletionItem>();

  for (const fp of compiler.layout.getEntryPoints()) {
    if (fp.equals(currentFilepath)) continue;
    let relPath = fp.relativeTo(currentDir);
    if (relPath.endsWith('.dbml')) relPath = relPath.slice(0, -5);
    if (!relPath.startsWith('.')) relPath = `./${relPath}`;

    if (prefix && !relPath.startsWith(prefix)) continue;

    // Only surface direct children of the current prefix. If the remaining
    // tail after the prefix still contains a `/`, collapse it into a
    // synthetic directory entry so the user can descend one level at a time
    // instead of being flooded with every descendant.
    const tail = relPath.slice(prefix.length);
    const slashIdx = tail.indexOf('/');
    const isDir = slashIdx !== -1;
    const childLabel = isDir
      ? `${prefix}${tail.slice(0, slashIdx + 1)}`  // e.g. `./foo/`
      : relPath;

    if (byLabel.has(childLabel)) continue;
    const insertText = insertQuoted ? `'${childLabel}'` : childLabel;
    byLabel.set(childLabel, {
      label: childLabel,
      insertText,
      insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
      kind: isDir ? CompletionItemKind.Folder : CompletionItemKind.File,
      sortText: `${isDir ? '0' : '1'}${childLabel}`, // folders first
      range,
    });
  }

  return {
    suggestions: [
      ...byLabel.values(),
    ],
  };
}

// Range covering the content between the importPath's opening and closing
// quotes. If the token is unterminated (e.g. the user hasn't typed the
// closing quote yet) we shrink from the start (skip the opening quote) and
// extend to token end.
function computeImportPathRange (model: TextModel, importPath: SyntaxToken) {
  const raw = sourceText(model, importPath);
  const hasOpenQuote = raw.startsWith('\'') || raw.startsWith('"');
  const hasCloseQuote = raw.length > 1 && (raw.endsWith('\'') || raw.endsWith('"'));
  const contentStart = importPath.start + (hasOpenQuote ? 1 : 0);
  const contentEnd = importPath.end - (hasCloseQuote ? 1 : 0);
  const startPos = model.getPositionAt(contentStart);
  const endPos = model.getPositionAt(contentEnd);
  return {
    startLineNumber: startPos.lineNumber,
    startColumn: startPos.column,
    endLineNumber: endPos.lineNumber,
    endColumn: endPos.column,
  };
}

function sourceText (model: TextModel, token: SyntaxToken): string {
  const startPos = model.getPositionAt(token.start);
  const endPos = model.getPositionAt(token.end);
  return model.getValueInRange({
    startLineNumber: startPos.lineNumber,
    startColumn: startPos.column,
    endLineNumber: endPos.lineNumber,
    endColumn: endPos.column,
  });
}

function stripQuotes (s: string): string {
  if (s.length >= 2 && (s.startsWith('\'') || s.startsWith('"'))) {
    const open = s[0];
    let content = s.slice(1);
    if (content.endsWith(open)) content = content.slice(0, -1);
    return content;
  }
  return s;
}
