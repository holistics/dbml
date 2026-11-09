import type Compiler from '@/compiler';
import Lexer from '@/core/lexer/lexer';
import type { Filepath } from '@/core/types/filepath';
import { type SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';

export type FileKind = 'dbml' | 'arch';

export const ARCH_DIAGRAM_TYPES = new Set(['arch', 'architecture']);

export const isArchDiagramType = (type: string | null | undefined): boolean => !!type && ARCH_DIAGRAM_TYPES.has(type.toLowerCase());

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

// Lex the file and extract front matter key-value pairs
export function frontMatter (this: Compiler, filepath: Filepath): Record<string, string> {
  const source = this.getSource(filepath) ?? '';
  const tokens = new Lexer(source, filepath, { allowFrontMatter: true }).lex().getValue();
  const block = frontMatterToken(tokens);
  return block ? readFrontMatter(block.value) : {};
}

// Determine whether a file is a DBML or architecture file from its front matter
export function fileKind (this: Compiler, filepath: Filepath): FileKind {
  return isArchDiagramType(this.frontMatter(filepath).diagram_type) ? 'arch' : 'dbml';
}
