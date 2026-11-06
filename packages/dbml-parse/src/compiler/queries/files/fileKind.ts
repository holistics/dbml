import { type SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';

export type FileKind = 'dbml' | 'arch';

export const ARCH_DIAGRAM_TYPES = new Set(['arch', 'architecture']);

export const isArchDiagramType = (type: string | null | undefined): boolean => !!type && ARCH_DIAGRAM_TYPES.has(type.toLowerCase());

// What decides a file's kind, read from its tokens without parsing
export interface FileScan {
  frontMatter: Record<string, string>;
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

export function scanTokens (tokens: readonly SyntaxToken[]): FileScan {
  const block = frontMatterToken(tokens);
  return { frontMatter: block ? readFrontMatter(block.value) : {} };
}

// Only `diagram_type` in front matter makes a file an architecture file
export function decideFileKind (scan: FileScan): FileKind {
  return isArchDiagramType(scan.frontMatter.diagram_type) ? 'arch' : 'dbml';
}
