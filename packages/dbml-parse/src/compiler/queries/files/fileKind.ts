import { roleName } from '@/core/arch/vocabulary';
import { type SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';

export type FileKind = 'dbml' | 'arch';

export const ARCH_DIAGRAM_TYPES = new Set(['arch', 'architecture']);

export const isArchDiagramType = (type: string | null | undefined): boolean => !!type && ARCH_DIAGRAM_TYPES.has(type.toLowerCase());

// What decides a file's kind, read from its tokens without parsing
export interface FileScan {
  frontMatter: Record<string, string>;
  // Lowercased words that open a top-level declaration
  topWords: string[];
}

export function readFrontMatter (block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const text = line.trim();
    if (!text || text === '---') continue;
    const colon = text.indexOf(':');
    if (colon <= 0) continue;
    const key = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) out[key] = value;
  }
  return out;
}

// The block is trivia, so it arrives on the first real token (or on EOF in an otherwise empty file)
export function frontMatterToken (tokens: readonly SyntaxToken[]): SyntaxToken | undefined {
  return tokens[0]?.leadingTrivia.find((t) => t.kind === SyntaxTokenKind.FRONT_MATTER);
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
  const block = frontMatterToken(tokens);
  const scan: FileScan = {
    frontMatter: block ? readFrontMatter(block.value) : {},
    topWords: [],
  };

  let depth = 0;
  let previousLine = -1;
  for (const token of tokens) {
    if (token.kind === SyntaxTokenKind.EOF) break;

    const startsLine = token.startPos.line > previousLine;
    previousLine = token.endPos.line;

    if (OPENERS.has(token.kind)) depth += 1;
    else if (CLOSERS.has(token.kind)) depth = Math.max(0, depth - 1);
    if (depth !== 0 || !startsLine || token.kind !== SyntaxTokenKind.IDENTIFIER) continue;

    scan.topWords.push(token.value.toLowerCase());
  }

  return scan;
}

// A `Kind` line marks an architecture file so that it can be reported
const isArchWord = (word: string) => word === 'group' || word === 'kind' || roleName(word) !== undefined;

export function decideFileKind (scan: FileScan): FileKind {
  if (scan.frontMatter.diagram_type !== undefined) {
    return isArchDiagramType(scan.frontMatter.diagram_type) ? 'arch' : 'dbml';
  }
  return scan.topWords.some(isArchWord) ? 'arch' : 'dbml';
}
