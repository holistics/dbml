import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

function getInfos (source: string) {
  const result = interpret(source);
  return result.getInfos();
}

describe('[example] diagnostics - infos deduplication', () => {
  test('inline ref should not produce duplicate infos', () => {
    const source = `
      Table posts {
        id integer [primary key]
        user_id integer [ref: > users.id]
      }
      Table users {
        id integer [primary key]
      }
    `;
    const infos = getInfos(source);
    const messages = infos.map((i) => `${i.diagnostic}:${i.nodeOrToken.startPos.line}:${i.nodeOrToken.startPos.column}`);
    const unique = new Set(messages);
    expect(messages.length).toBe(unique.size);
  });

  test('standalone ref produces separate infos for ref and column', () => {
    const source = `
      Table posts {
        id integer [primary key]
        user_id integer
      }
      Table users {
        id integer [primary key]
      }
      Ref: posts.user_id > users.id
    `;
    const infos = getInfos(source);
    const nullable = infos.filter((i) => i.diagnostic.includes('nullable'));
    // Should have 2 infos: one on the ref, one on the column declaration
    expect(nullable.length).toBe(2);
    // They should point to different locations
    const locations = nullable.map((i) => `${i.nodeOrToken.startPos.line}:${i.nodeOrToken.startPos.column}`);
    expect(new Set(locations).size).toBe(2);
  });
});
