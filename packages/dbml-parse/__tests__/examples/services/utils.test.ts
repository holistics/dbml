import { describe, expect, it } from 'vitest';
import { getOffsetFromMonacoPosition } from '@/services/utils';
import type { TextModel, Position } from '@/services/types';

// Mock TextModel for testing
class MockTextModel implements Partial<TextModel> {
  private content: string;
  uri: string;

  constructor(content: string, uri = 'file:///test.dbml') {
    this.content = content;
    this.uri = uri;
  }

  getOffsetAt(position: Position): number {
    const lines = this.content.split('\n');
    let offset = 0;

    for (let i = 0; i < position.lineNumber - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }

    offset += position.column - 1;
    return offset;
  }

  getValue(): string {
    return this.content;
  }
}

describe('Services Utils', () => {
  describe('getOffsetFromMonacoPosition', () => {
    it('should calculate offset from position correctly', () => {
      const program = 'Line1\nLine2\nLine3';
      const model = new MockTextModel(program) as any;

      const position1: Position = { lineNumber: 1, column: 1 };
      const offset1 = getOffsetFromMonacoPosition(model, position1);
      expect(offset1).toBe(0);

      const position2: Position = { lineNumber: 2, column: 1 };
      const offset2 = getOffsetFromMonacoPosition(model, position2);
      expect(offset2).toBe(6);

      const position3: Position = { lineNumber: 3, column: 3 };
      const offset3 = getOffsetFromMonacoPosition(model, position3);
      expect(offset3).toBe(14);
    });

    it('should handle empty content', () => {
      const program = '';
      const model = new MockTextModel(program) as any;

      const position: Position = { lineNumber: 1, column: 1 };
      const offset = getOffsetFromMonacoPosition(model, position);
      expect(offset).toBe(0);
    });

    it('should handle single line content', () => {
      const program = 'Single line';
      const model = new MockTextModel(program) as any;

      const position: Position = { lineNumber: 1, column: 5 };
      const offset = getOffsetFromMonacoPosition(model, position);
      expect(offset).toBe(4);
    });

    it('should handle position at end of line', () => {
      const program = 'Hello\nWorld';
      const model = new MockTextModel(program) as any;

      const position: Position = { lineNumber: 1, column: 6 };
      const offset = getOffsetFromMonacoPosition(model, position);
      expect(offset).toBe(5);
    });

    it('should handle multiline content', () => {
      const program = 'Table users {\n  id int\n  name varchar\n}';
      const model = new MockTextModel(program) as any;

      const position1: Position = { lineNumber: 2, column: 3 };
      const offset1 = getOffsetFromMonacoPosition(model, position1);
      expect(offset1).toBeGreaterThan(13);

      const position2: Position = { lineNumber: 3, column: 3 };
      const offset2 = getOffsetFromMonacoPosition(model, position2);
      expect(offset2).toBeGreaterThan(offset1);
    });

    it('should call model getOffsetAt method', () => {
      const program = 'Test content';
      const model = new MockTextModel(program) as any;

      const position: Position = { lineNumber: 1, column: 3 };
      const offset = getOffsetFromMonacoPosition(model, position);

      // Should delegate to the model's method
      expect(offset).toBe(model.getOffsetAt(position));
    });
  });
});
