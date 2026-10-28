import type Compiler from '@/compiler/index';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { SymbolKind } from '@/core/types/symbol';
import {
  type CompletionItem,
  CompletionItemInsertTextRule,
} from '@/services/types';
import {
  mergeSymbolIntoUses,
  pickCompletionItemKind,
} from './utils';

// Cross-file completion suggestions: surface symbols declared in other project files
// Accepted suggestions insert a matching `use { ... } from './...'` via additionalTextEdits
export function collectCrossFileSuggestions (
  compiler: Compiler,
  acceptedKinds: SymbolKind[],
  currentFilepath: Filepath,
): CompletionItem[] {
  const out: CompletionItem[] = [];
  const seen = new Set<string>();
  const currentContent = compiler.layout.getSource(currentFilepath) ?? '';

  for (const filepath of compiler.layout.getEntrypoints()) {
    if (filepath.equals(currentFilepath)) continue;
    const usable = compiler.usableMembers(filepath).getFiltered(UNHANDLED);
    if (!usable) continue;
    for (const sym of [
      ...usable.nonSchemaMembers,
      ...usable.schemaMembers,
    ]) {
      if (!acceptedKinds.includes(sym.kind)) continue;
      const name = sym.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(buildCrossFileCompletionItem(compiler, name, sym.kind, fp, currentFilepath, currentContent));
    }
  }
  return out;
}

export function buildCrossFileCompletionItem (
  compiler: Compiler,
  symbolName: string,
  symbolKind: SymbolKind,
  sourceFilepath: Filepath,
  currentFilepath: Filepath,
  currentFileContent: string,
): CompletionItem {
  const mergeResult = mergeSymbolIntoUses(
    compiler,
    symbolName,
    symbolKind,
    sourceFilepath,
    currentFilepath,
    currentFileContent,
  );

  const additionalTextEdits: Array<{
    range: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    };
    text: string;
  }> = [];

  if (mergeResult.topInsert) {
    additionalTextEdits.push({
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      },
      text: mergeResult.topInsert,
    });
  }
  if (mergeResult.removeRange) {
    const start = offsetToPosition(currentFileContent, mergeResult.removeRange.startOffset);
    const end = offsetToPosition(currentFileContent, mergeResult.removeRange.endOffset);
    additionalTextEdits.push({
      range: {
        startLineNumber: start.line,
        startColumn: start.column,
        endLineNumber: end.line,
        endColumn: end.column,
      },
      text: '',
    });
  }

  return {
    label: symbolName,
    insertText: symbolName,
    insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
    kind: pickCompletionItemKind(symbolKind),
    detail: `from ${compiler.layout.getFileSpecifierInfo(currentFilepath, sourceFilepath)?.label ?? sourceFilepath.basename}`,
    // Sort cross-file suggestions after local ones.
    sortText: `zzz_${pickCompletionItemKind(symbolKind).toString().padStart(2, '0')}_${symbolName}`,
    range: undefined as any,
    additionalTextEdits,
  };
}

function offsetToPosition (content: string, offset: number): { line: number;
  column: number; } {
  let line = 1;
  let col = 1;
  for (let index = 0; index < offset && index < content.length; index++) {
    if (content[index] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return {
    line,
    column: col,
  };
}
