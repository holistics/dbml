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
    const lines = this.content.split('\n');
    let offset = 0;

    for (let i = 0; i < position.lineNumber - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1;
    }

    offset += Math.min(position.column - 1, lines[position.lineNumber - 1]?.length || 0);
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
