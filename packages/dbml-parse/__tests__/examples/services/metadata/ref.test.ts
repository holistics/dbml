import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import { DEFAULT_ENTRY } from '@/constants';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/index';
import { createMockTextModel, createPosition, interpret } from '../../../utils';

const TABLES = `Table users {
  id int [pk]
}

Table posts {
  id int [pk]
  user_id int
  author_id int
}

`;

function refs (source: string) {
  return interpret(TABLES + source).getValue()?.refs ?? [];
}

function ref (source: string, name: string) {
  return refs(source).find((r) => r.name === name);
}

function errorCodes (source: string) {
  return interpret(TABLES + source).getErrors().map((e) => e.code);
}

function setup (program: string) {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, program);
  return {
    compiler: new Compiler(layout),
    model: createMockTextModel(program),
  };
}

describe('[example] Metadata Ref', () => {
  describe('color promotion', () => {
    it('overrides the inline color of a named ref', () => {
      const source = `Ref user_posts: posts.user_id > users.id [color: #111111]

Metadata Ref user_posts {
  color: #e67e22
}`;
      expect(errorCodes(source)).toEqual([]);
      const r = ref(source, 'user_posts')!;
      expect(r.color).toBe('#e67e22');
      // color is a builtin, so it is not kept in the free-form bag
      expect(r.metadata).toEqual({});
    });

    it('sets the color of a named ref with no inline color', () => {
      const source = `Ref user_posts {
  posts.user_id > users.id
}

Metadata Ref user_posts {
  color: #abc
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(ref(source, 'user_posts')?.color).toBe('#abc');
    });

    it('rejects a non-color color value', () => {
      const source = `Ref user_posts: posts.user_id > users.id

Metadata Ref user_posts {
  color: 'red'
}`;
      expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
    });
  });

  describe('free-form metadata', () => {
    it('stores non-builtin keys in ref.metadata', () => {
      const source = `Ref user_posts: posts.user_id > users.id

Metadata Ref user_posts {
  owner: 'team-a'
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(ref(source, 'user_posts')?.metadata).toEqual({ owner: 'team-a' });
    });

    it('does not promote inactive: it stays free-form like Column pk', () => {
      const source = `Ref user_posts: posts.user_id > users.id

Metadata Ref user_posts {
  inactive: 'true'
}`;
      expect(errorCodes(source)).toEqual([]);
      const r = ref(source, 'user_posts')!;
      expect(r.inactive).toBeUndefined();
      expect(r.metadata).toEqual({ inactive: 'true' });
    });

    it('leaves other refs untouched', () => {
      const source = `Ref user_posts: posts.user_id > users.id
Ref author_posts: posts.author_id > users.id [color: #222222]

Metadata Ref user_posts {
  color: #e67e22
}`;
      expect(ref(source, 'author_posts')?.color).toBe('#222222');
    });
  });

  describe('target resolution', () => {
    it('reports an unknown ref name', () => {
      const source = `Ref user_posts: posts.user_id > users.id

Metadata Ref nope {
  color: #e67e22
}`;
      const errors = interpret(TABLES + source).getErrors();
      expect(errors.map((e) => e.code)).toContain(CompileErrorCode.BINDING_ERROR);
      expect(errors.map((e) => e.diagnostic)).toContain('cannot find metadata target element');
    });

    it('rejects targeting an unnamed ref by its endpoints', () => {
      const source = `Ref: posts.user_id > users.id

Metadata Ref posts.user_id > users.id {
  color: #e67e22
}`;
      expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_NAME);
    });

    it('rejects a schema-qualified ref target', () => {
      const source = `Ref user_posts: posts.user_id > users.id

Metadata Ref public.user_posts {
  color: #e67e22
}`;
      expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_NAME);
    });

    it('accepts a quoted ref name', () => {
      const source = `Ref "user posts": posts.user_id > users.id

Metadata Ref "user posts" {
  color: #e67e22
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(ref(source, 'user posts')?.color).toBe('#e67e22');
    });
  });

  describe('duplicate ref names', () => {
    it('reports two refs with the same name in one file', () => {
      const source = `Ref r: posts.user_id > users.id
Ref r: posts.author_id > users.id`;
      const errors = interpret(TABLES + source).getErrors();
      expect(errors.map((e) => e.code)).toContain(CompileErrorCode.DUPLICATE_NAME);
      expect(errors.map((e) => e.diagnostic)).toContain("Ref 'r' already exists in schema 'public'");
    });

    it('allows a ref to share its name with a table', () => {
      const source = 'Ref users: posts.user_id > users.id';
      expect(errorCodes(source)).toEqual([]);
    });

    it('allows any number of unnamed refs', () => {
      const source = `Ref: posts.user_id > users.id
Ref: posts.author_id > users.id`;
      expect(errorCodes(source)).toEqual([]);
    });
  });
});

describe('[example] Ref inline custom metadata', () => {
  it('stores custom settings of a named ref in ref.metadata', () => {
    const source = "Ref r: posts.user_id > users.id [delete: cascade, owner: 'team-a', color: #123456]";
    expect(errorCodes(source)).toEqual([]);
    const r = ref(source, 'r')!;
    expect(r.metadata).toEqual({ owner: 'team-a' });
    expect(r.color).toBe('#123456');
    expect(r.onDelete).toBe('cascade');
  });

  it('stores custom settings of an unnamed ref in ref.metadata', () => {
    const source = "Ref: posts.user_id > users.id [owner: 'team-a', accent: #fff]";
    expect(errorCodes(source)).toEqual([]);
    expect(refs(source)[0].metadata).toEqual({ owner: 'team-a', accent: '#fff' });
  });

  it('reports a duplicate custom setting', () => {
    const source = "Ref r: posts.user_id > users.id [owner: 'a', owner: 'b']";
    expect(errorCodes(source)).toContain(CompileErrorCode.DUPLICATE_REF_SETTING);
  });

  it('reports a custom setting whose value is not a string or color', () => {
    const source = 'Ref r: posts.user_id > users.id [owner: 42]';
    expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_REF_SETTING_VALUE);
  });

  it('lets a Metadata block override an inline custom setting', () => {
    const source = `Ref r: posts.user_id > users.id [owner: 'inline']

Metadata Ref r {
  owner: 'block'
}`;
    expect(ref(source, 'r')?.metadata).toEqual({ owner: 'block' });
  });
});

describe('[example] Metadata Ref services', () => {
  const program = `${TABLES}Ref user_posts: posts.user_id > users.id

Metadata Ref user_posts {
  color: #e67e22
}`;
  // `Ref user_posts` is on line 11, `Metadata Ref user_posts` on line 13
  const metadataLine = 13;

  it('go-to-definition on the target name jumps to the ref declaration', () => {
    const { compiler, model } = setup(program);
    const provider = new DBMLDefinitionProvider(compiler);
    const definition = provider.provideDefinition(model, createPosition(metadataLine, 16));
    const locations = Array.isArray(definition) ? definition : [definition];
    expect(locations).toHaveLength(1);
    expect(locations[0].range.startLineNumber).toBe(11);
  });

  it('find-references on the ref name includes the Metadata target', () => {
    const { compiler, model } = setup(program);
    const provider = new DBMLReferencesProvider(compiler);
    const references = provider.provideReferences(model, createPosition(11, 6));
    expect(references.map((r) => r.range.startLineNumber)).toContain(metadataLine);
  });

  it('suggests Ref as a Metadata target kind', () => {
    const source = 'Metadata ';
    const { compiler, model } = setup(source);
    const provider = new DBMLCompletionItemProvider(compiler);
    const labels = provider.provideCompletionItems(model, createPosition(1, 10)).suggestions.map((s) => s.label);
    expect(labels).toContain('Ref');
  });

  it('suggests visible named refs, but not tables or unnamed refs, after `Metadata Ref`', () => {
    const source = `${TABLES}Ref user_posts: posts.user_id > users.id
Ref "author posts": posts.author_id > users.id
Ref: posts.id > users.id

Metadata Ref `;
    const { compiler, model } = setup(source);
    const provider = new DBMLCompletionItemProvider(compiler);
    const suggestions = provider.provideCompletionItems(model, createPosition(15, 14)).suggestions;
    expect(suggestions.map((s) => s.label)).toEqual(['user_posts', 'author posts']);
    expect(suggestions.map((s) => s.insertText)).toEqual(['user_posts', '"author posts"']);
  });
});
