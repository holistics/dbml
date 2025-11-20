import { describe, expect, it } from 'vitest';
import { getOffsetFromMonacoPosition } from '@/services/utils';
import { createPosition, MockTextModel } from '../../mocks';

describe('Services Utils', () => {
  describe('getOffsetFromMonacoPosition', () => {
    it('should calculate offset from position correctly', () => {
      const program = 'Line1\nLine2\nLine3';
      const model = new MockTextModel(program) as any;

      const position1 = createPosition(1, 1);
      const offset1 = getOffsetFromMonacoPosition(model, position1);
      expect(offset1).toBe(0);

      const position2 = createPosition(2, 1);
      const offset2 = getOffsetFromMonacoPosition(model, position2);
      expect(offset2).toBe(6);

      const position3 = createPosition(3, 3);
      const offset3 = getOffsetFromMonacoPosition(model, position3);
      expect(offset3).toBe(14);
    });

    it('should handle empty content', () => {
      const program = '';
      const model = new MockTextModel(program) as any;

      const position = createPosition(1, 1);
      const offset = getOffsetFromMonacoPosition(model, position);
      expect(offset).toBe(0);
    });

    it('should handle single line content', () => {
      const program = 'Single line';
      const model = new MockTextModel(program) as any;

      const position = createPosition(1, 5);
      const offset = getOffsetFromMonacoPosition(model, position);
      expect(offset).toBe(4);
    });

    it('should handle position at end of line', () => {
      const program = 'Hello\nWorld';
      const model = new MockTextModel(program) as any;

      const position = createPosition(1, 6);
      const offset = getOffsetFromMonacoPosition(model, position);
      expect(offset).toBe(5);
    });

    it('should handle multiline content', () => {
      const program = 'Table users {\n  id int\n  name varchar\n}';
      const model = new MockTextModel(program) as any;

      const position1 = createPosition(2, 3);
      const offset1 = getOffsetFromMonacoPosition(model, position1);
      expect(offset1).toBeGreaterThan(13);

      const position2 = createPosition(3, 3);
      const offset2 = getOffsetFromMonacoPosition(model, position2);
      expect(offset2).toBeGreaterThan(offset1);
    });

    it('should call model getOffsetAt method', () => {
      const program = 'Test content';
      const model = new MockTextModel(program) as any;

      const position = createPosition(1, 3);
      const offset = getOffsetFromMonacoPosition(model, position);

      // Should delegate to the model's method
      expect(offset).toBe(model.getOffsetAt(position));
    });
  });
});
