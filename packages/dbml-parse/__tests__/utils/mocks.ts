import { type Position, type TextModel } from '@/services';

export function createPosition (lineNumber: number, column: number): Position {
  return {
    lineNumber,
    column,
  } as Position;
}

// Mock TextModel for property testing
export class MockTextModel {
  private content: string;
  public uri: any;

  constructor (content: string, uri: string = '') {
    this.content = content;
    this.uri = uri;
  }

  getOffsetAt (position: Position): number {
    // Split on all line ending types while preserving them for accurate offset calculation
    const lineEndingRegex = /\r\n|\r|\n/g;
    let lastIndex = 0;
    const lines: Array<{ text: string; ending: string }> = [];

    let match;
    while ((match = lineEndingRegex.exec(this.content)) !== null) {
      lines.push({
        text: this.content.slice(lastIndex, match.index),
        ending: match[0],
      });
      lastIndex = match.index + match[0].length;
    }
    // Add remaining content after last line ending
    lines.push({ text: this.content.slice(lastIndex), ending: '' });

    let offset = 0;
    for (let i = 0; i < position.lineNumber - 1 && i < lines.length; i++) {
      offset += lines[i].text.length + lines[i].ending.length;
    }

    const currentLine = lines[position.lineNumber - 1];
    if (currentLine) {
      offset += Math.min(position.column - 1, currentLine.text.length);
    }
    return Math.max(0, offset);
  }

  getValue (): string {
    return this.content;
  }
}

export function createMockTextModel (content: string, uri: string = ''): TextModel {
  return new MockTextModel(content, uri) as unknown as TextModel;
}

// Extract source text from a range in the program
export function extractTextFromRange (program: string, range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }): string {
  const mockModel = new MockTextModel(program);

  const startOffset = mockModel.getOffsetAt({
    lineNumber: range.startLineNumber,
    column: range.startColumn,
  } as Position);

  const endOffset = mockModel.getOffsetAt({
    lineNumber: range.endLineNumber,
    column: range.endColumn,
  } as Position);

  return program.substring(startOffset, endOffset);
}
