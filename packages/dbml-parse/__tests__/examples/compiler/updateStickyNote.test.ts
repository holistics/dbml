import {
  describe, expect, test,
} from 'vitest';
import { DEFAULT_ENTRY } from '@/constants';
import Compiler from '@/compiler/index';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { UpdateStickyNoteInput } from '@/compiler/queries/transform';

function updateStickyNote (input: UpdateStickyNoteInput, dbml: string): string {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbml);
  const compiler = new Compiler(layout);
  const changes = compiler.updateStickyNote(DEFAULT_ENTRY, input);
  return changes.get(DEFAULT_ENTRY.absolute) ?? dbml;
}

describe('[example] updateStickyNote', () => {
  describe('update content', () => {
    test('should update single-line content', () => {
      const dbml = `
Note my_note {
  'old content'
}
`;
      const result = updateStickyNote({ name: 'my_note', content: 'new content' }, dbml);
      expect(result).toContain('new content');
      expect(result).not.toContain('old content');
    });

    test('should update multiline content', () => {
      const dbml = `
Note my_note {
  '''
    old content
  '''
}
`;
      const result = updateStickyNote({ name: 'my_note', content: 'new content' }, dbml);
      expect(result).toContain('new content');
      expect(result).not.toContain('old content');
    });

    test('should always use multiline quotes for new content', () => {
      const dbml = `
Note my_note {
  'old content'
}
`;
      const result = updateStickyNote({ name: 'my_note', content: 'short' }, dbml);
      expect(result).toContain("'''");
    });

    test('should preserve note name and structure', () => {
      const dbml = `
Note my_note {
  'old content'
}
`;
      const result = updateStickyNote({ name: 'my_note', content: 'new content' }, dbml);
      expect(result).toContain('Note my_note');
    });

    test('should preserve other elements', () => {
      const dbml = `
Table users {
  id int [pk]
}

Note my_note {
  'old content'
}

Table posts {
  id int [pk]
}
`;
      const result = updateStickyNote({ name: 'my_note', content: 'new content' }, dbml);
      expect(result).toContain('Table users');
      expect(result).toContain('Table posts');
      expect(result).toContain('new content');
    });
  });

  describe('update color', () => {
    test('should add color to note without color', () => {
      const dbml = `
Note my_note {
  'content'
}
`;
      const result = updateStickyNote({ name: 'my_note', color: '#FF0000' }, dbml);
      expect(result).toContain('[color: #FF0000]');
      expect(result).toContain('content');
    });

    test('should update existing color', () => {
      const dbml = `
Note my_note [color: #000000] {
  'content'
}
`;
      const result = updateStickyNote({ name: 'my_note', color: '#FF0000' }, dbml);
      expect(result).toContain('[color: #FF0000]');
      expect(result).not.toContain('#000000');
    });

    test('should remove color when set to null', () => {
      const dbml = `
Note my_note [color: #FF0000] {
  'content'
}
`;
      const result = updateStickyNote({ name: 'my_note', color: null }, dbml);
      expect(result).not.toContain('[color');
      expect(result).not.toContain('#FF0000');
      expect(result).toContain('content');
    });

    test('should be no-op when removing color that does not exist', () => {
      const dbml = `
Note my_note {
  'content'
}
`;
      const result = updateStickyNote({ name: 'my_note', color: null }, dbml);
      expect(result).toBe(dbml);
    });
  });

  describe('update both content and color', () => {
    test('should update both content and color', () => {
      const dbml = `
Note my_note [color: #000000] {
  'old content'
}
`;
      const result = updateStickyNote({ name: 'my_note', content: 'new content', color: '#FF0000' }, dbml);
      expect(result).toContain('new content');
      expect(result).not.toContain('old content');
      expect(result).toContain('[color: #FF0000]');
      expect(result).not.toContain('#000000');
    });

    test('should add color and update content', () => {
      const dbml = `
Note my_note {
  'old content'
}
`;
      const result = updateStickyNote({ name: 'my_note', content: 'new content', color: '#FF0000' }, dbml);
      expect(result).toContain('new content');
      expect(result).toContain('[color: #FF0000]');
    });

    test('should remove color and update content', () => {
      const dbml = `
Note my_note [color: #FF0000] {
  'old content'
}
`;
      const result = updateStickyNote({ name: 'my_note', content: 'new content', color: null }, dbml);
      expect(result).toContain('new content');
      expect(result).not.toContain('[color');
    });
  });

  describe('note not found', () => {
    test('should return unchanged dbml when note does not exist', () => {
      const dbml = `
Note my_note {
  'content'
}
`;
      const result = updateStickyNote({ name: 'nonexistent', content: 'new content' }, dbml);
      expect(result).toBe(dbml);
    });

    test('should return unchanged dbml when input is empty', () => {
      const dbml = '';
      const result = updateStickyNote({ name: 'my_note', content: 'new content' }, dbml);
      expect(result).toBe(dbml);
    });
  });

  describe('quoted note names', () => {
    test('should update note with quoted name', () => {
      const dbml = `
Note "my note" {
  'old content'
}
`;
      const result = updateStickyNote({ name: 'my note', content: 'new content' }, dbml);
      expect(result).toContain('new content');
      expect(result).not.toContain('old content');
    });

    test('should not find note with schema-qualified name using bare name', () => {
      const dbml = `
Note "schema"."my_note" [color: #3457DB] {
  '''
    old content
  '''
}
`;
      const result = updateStickyNote({ name: 'my_note', content: 'new content' }, dbml);
      expect(result).toBe(dbml);
    });
  });
});
