/**
 * READING THE FRONT MATTER WITHOUT A COMPILER, which is the whole point of it being there.
 *
 * A host holding a string has to answer one question before it can do anything else: is this a
 * database schema or an architecture diagram? The two want different parser options, a
 * different module list and a different renderer, so the answer has to arrive BEFORE any of
 * that is chosen.
 *
 * That is only possible because the marker lives in front matter. The block is fenced, it is
 * the first thing in the file, and finding it is a regular expression over the head of a
 * string: no lexer, no parser, no compiler, nothing to allocate. Had the marker lived inside
 * `Project { ... }` there would have been no way to reach it except by parsing the file, and
 * parsing is exactly the thing being chosen. That is not a style preference; it is the reason
 * the placement is what it is.
 *
 * `scanFrontMatter` and the lexer's own reading of the same block have to agree, or a document
 * would be routed to one pipeline and then describe itself as the other. A test asserts they
 * agree on every sample this package ships.
 */

/** the fenced block at the very top, and nothing else counts as one */
const BLOCK = /^﻿?\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function scanFrontMatter (source: string): Record<string, string> {
  const block = BLOCK.exec(source);
  if (!block) return {};

  const out: Record<string, string> = {};
  for (const line of block[1].split('\n')) {
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

/** `arch` is what it is called; `architecture` is what it used to be called */
export const ARCH_TYPES = new Set(['arch', 'architecture']);

export const isArchDiagramType = (type: string | null | undefined): boolean =>
  !!type && ARCH_TYPES.has(type.toLowerCase());

/**
 * What this document says it is, read off the string and nothing else.
 *
 * This is the function a host calls first. It is cheap enough to run on every keystroke and it
 * never throws, so routing a document costs nothing and cannot fail.
 */
export const diagramTypeOf = (source: string): string | null =>
  scanFrontMatter(source).diagram_type ?? null;

/** the question a host actually has: do I send this to the architecture compiler? */
export const isArchitectureSource = (source: string): boolean =>
  isArchDiagramType(diagramTypeOf(source));
