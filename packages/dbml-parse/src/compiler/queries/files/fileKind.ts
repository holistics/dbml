import { builtinKindName } from '@/core/arch/vocabulary';
import { type SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';

export type FileKind = 'dbml' | 'arch';

export const ARCH_DIAGRAM_TYPES = new Set(['arch', 'architecture']);

export const isArchDiagramType = (type: string | null | undefined): boolean => !!type && ARCH_DIAGRAM_TYPES.has(type.toLowerCase());

// What decides a file's kind, read from its tokens without parsing
export interface FileScan {
  frontMatter: Record<string, string>;
  // Lowercased words that open a top-level declaration
  topWords: string[];
  // Lowercased names declared by top-level `Kind` lines
  kindNames: string[];
  // Import paths of top-level `use` and `reuse` lines
  usePaths: string[];
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
    kindNames: [],
    usePaths: [],
  };

  let depth = 0;
  let previousLine = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.kind === SyntaxTokenKind.EOF) break;

    const startsLine = token.startPos.line > previousLine;
    previousLine = token.endPos.line;

    if (OPENERS.has(token.kind)) depth += 1;
    else if (CLOSERS.has(token.kind)) depth = Math.max(0, depth - 1);
    if (depth !== 0 || !startsLine || token.kind !== SyntaxTokenKind.IDENTIFIER) continue;

    const word = token.value.toLowerCase();
    scan.topWords.push(word);

    if (word === 'kind') {
      const name = tokens[i + 1];
      if (name?.kind === SyntaxTokenKind.IDENTIFIER || name?.kind === SyntaxTokenKind.QUOTED_STRING) {
        scan.kindNames.push(name.value.toLowerCase());
      }
    }

    if (word === 'use' || word === 'reuse') {
      let nested = 0;
      for (let j = i + 1; j < tokens.length; j += 1) {
        const next = tokens[j];
        if (next.kind === SyntaxTokenKind.EOF) break;
        if (OPENERS.has(next.kind)) nested += 1;
        else if (CLOSERS.has(next.kind)) nested -= 1;
        else if (nested === 0 && next.kind === SyntaxTokenKind.IDENTIFIER && next.value === 'from') {
          const path = tokens[j + 1];
          if (path?.kind === SyntaxTokenKind.STRING_LITERAL) scan.usePaths.push(path.value);
          break;
        }
      }
    }
  }

  return scan;
}

export interface FileKindResult {
  kind: FileKind;
  // Whether the answer came from `Kind` names in imported files, so it can change when they do
  dependsOnImports: boolean;
}

// The syntax doc's "Document Type" and "Without a marker" rules.
// `importedScans` is only called when the file's own text cannot decide.
export function decideFileKind (scan: FileScan, importedScans: () => FileScan[]): FileKindResult {
  if (scan.frontMatter.diagram_type !== undefined) {
    return {
      kind: isArchDiagramType(scan.frontMatter.diagram_type) ? 'arch' : 'dbml',
      dependsOnImports: false,
    };
  }

  const isArchWord = (word: string) => word === 'group' || word === 'kind' || builtinKindName(word) !== undefined;
  if (scan.topWords.some(isArchWord)) {
    return {
      kind: 'arch',
      dependsOnImports: false,
    };
  }

  if (scan.usePaths.length === 0) {
    return {
      kind: 'dbml',
      dependsOnImports: false,
    };
  }

  const importedKinds = new Set(importedScans().flatMap((s) => s.kindNames));
  return {
    kind: scan.topWords.some((word) => importedKinds.has(word)) ? 'arch' : 'dbml',
    dependsOnImports: true,
  };
}
