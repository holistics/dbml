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

export function isOffsetInUseDeclaration (
  offset: number,
  useDecl: UseDeclarationNode,
  bOcToken: SyntaxToken | undefined,
): boolean {
  if (!Number.isNaN(useDecl.start) && offset >= useDecl.start && offset <= useDecl.end) return true;
  return !!bOcToken && isTokenInUseDecl(bOcToken, useDecl);
}

export function suggestInUseDeclaration (
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
  const usable = compiler.fileUsableMembers(targetFilepath).getFiltered(UNHANDLED);
  if (!usable) return noSuggestions();

  const names: string[] = [];

  for (const member of usable.nonSchemaMembers) {
    if (member.kind !== symbolKind) continue;
    const name = compiler.symbolName(member);
    if (name) names.push(name);
  }

  for (const schema of usable.schemaMembers) {
    if (schema.isPublicSchema()) continue;
    const schemaName = compiler.symbolName(schema);
    if (!schemaName) continue;
    const schemaMembers = compiler.symbolMembers(schema).getFiltered(UNHANDLED) ?? [];
    for (const member of schemaMembers) {
      if (member.kind !== symbolKind) continue;
      const memberName = compiler.symbolName(member);
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
  const suggestions: CompletionItem[] = [];

  for (const fp of compiler.layout.getEntryPoints()) {
    if (fp.equals(currentFilepath)) continue;
    let relPath = fp.relativeTo(currentDir);
    if (relPath.endsWith('.dbml')) relPath = relPath.slice(0, -5);
    if (!relPath.startsWith('.')) relPath = `./${relPath}`;

    const insertText = `'${relPath}'`;
    let range: any = undefined as any;

    if (importPath) {
      const startPos = model.getPositionAt(importPath.start);
      const endPos = model.getPositionAt(importPath.end + 1);
      range = {
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
      };
    }

    suggestions.push({
      label: relPath,
      insertText,
      insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
      kind: CompletionItemKind.File,
      sortText: relPath,
      range,
    });
  }

  return {
    suggestions,
  };
}
