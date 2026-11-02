import { roleName } from '@/core/arch/vocabulary';
import { type SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';

export type FileKind = 'dbml' | 'arch';

export const ARCH_DIAGRAM_TYPES = new Set(['arch', 'architecture']);

export const isArchDiagramType = (type: string | null | undefined): boolean => !!type && ARCH_DIAGRAM_TYPES.has(type.toLowerCase());

// What decides a file's kind, read from its tokens without parsing
export interface FileScan {
  // The `diagram_type` row of the top-level `Project` block
  diagramType?: string;
  // Lowercased words that open a top-level declaration
  topWords: string[];
}

const OPENERS = new Set([
  SyntaxTokenKind.LBRACE,
  SyntaxTokenKind.LBRACKET,
  SyntaxTokenKind.LPAREN,
]);
const CLOSERS = new Set([
  SyntaxTokenKind.RBRACE,
  SyntaxTokenKind.RBRACKET,
  SyntaxTokenKind.RPAREN,
]);

export function scanTokens (tokens: readonly SyntaxToken[]): FileScan {
  const scan: FileScan = {
    topWords: [],
  };

  let depth = 0;
  let previousLine = -1;
  let inProject = false;
  for (const [i, token] of tokens.entries()) {
    if (token.kind === SyntaxTokenKind.EOF) break;

    const startsLine = token.startPos.line > previousLine;
    previousLine = token.endPos.line;

    if (OPENERS.has(token.kind)) depth += 1;
    else if (CLOSERS.has(token.kind)) depth = Math.max(0, depth - 1);
    if (depth === 0 && token.kind === SyntaxTokenKind.RBRACE) inProject = false;
    if (!startsLine || token.kind !== SyntaxTokenKind.IDENTIFIER) continue;

    const word = token.value.toLowerCase();
    if (depth === 0) {
      scan.topWords.push(word);
      inProject = word === 'project';
      continue;
    }
    // `diagram_type: 'arch'`, a row directly inside `Project { }`
    if (inProject && depth === 1 && word === 'diagram_type' && scan.diagramType === undefined) {
      const colon = tokens[i + 1];
      const value = tokens[i + 2];
      if (colon?.kind === SyntaxTokenKind.COLON && value?.kind === SyntaxTokenKind.STRING_LITERAL) scan.diagramType = value.value;
    }
  }

  return scan;
}

// A `Kind` line marks an architecture file so that it can be reported
const isArchWord = (word: string) => word === 'group' || word === 'kind' || roleName(word) !== undefined;

export function decideFileKind (scan: FileScan): FileKind {
  if (scan.diagramType !== undefined) {
    return isArchDiagramType(scan.diagramType) ? 'arch' : 'dbml';
  }
  return scan.topWords.some(isArchWord) ? 'arch' : 'dbml';
}
