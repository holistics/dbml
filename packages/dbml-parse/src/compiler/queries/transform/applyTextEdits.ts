export interface TextEdit {
  start: number;
  end: number;
  newText: string;
}

/**
 * Applies a sequence of text edits to a source string.
 *
 * @param source - The original source string
 * @param edits - Array of text edits to apply
 * @returns The modified source string with all edits applied
 */
export function applyTextEdits (source: string, edits: TextEdit[]): string {
  const sortedEdits = [...edits].sort((a, b) => b.start - a.start);

  let result = source;
  for (const { start, end, newText } of sortedEdits) {
    result = result.substring(0, start) + newText + result.substring(end);
  }

  return result;
}
