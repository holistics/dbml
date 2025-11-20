import { type Position, type TextModel } from '@/services';

export function createPosition (lineNumber: number, column: number): Position {
  return {
    lineNumber,
    column,
  } as Position;
}

// Mock TextModel for property testing
export class MockTextModel implements Partial<TextModel> {
  private content: string;

  constructor (content: string) {
    this.content = content;
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
