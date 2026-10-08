import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/index';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { createMockTextModel, createPosition } from '../../../utils';
import { getDatabase, setupCompiler, fp } from './utils';

const ORDERS = `
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
}
Ref user_posts: posts.user_id > users.id [color: #111111]
`;

describe('[example] multifile interpreter - Metadata Ref', () => {
  test('the importer restyles an imported ref without changing the defining file', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': ORDERS,
      '/reporting.dbml': `
use * from './orders.dbml'

Metadata Ref user_posts {
  color: #e67e22
  owner: 'reporting'
}
`,
    });

    const reporting = getDatabase(compiler, '/reporting.dbml').refs.find((r) => r.name === 'user_posts');
    expect(reporting?.color).toBe('#e67e22');
    expect(reporting?.metadata).toEqual({ owner: 'reporting' });

    const orders = getDatabase(compiler, '/orders.dbml').refs.find((r) => r.name === 'user_posts');
    expect(orders?.color).toBe('#111111');
    expect(orders?.metadata).toEqual({});
  });

  test('precedence: inline < imported Metadata block < current-file Metadata block', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': ORDERS,
      '/enrichment.dbml': `
use * from './orders.dbml'

Metadata Ref user_posts {
  color: #222222
  owner: 'enrichment'
  team: 'data'
}
`,
      '/main.dbml': `
use * from './enrichment.dbml'
use * from './orders.dbml'

Metadata Ref user_posts {
  owner: 'main'
}
`,
    });

    const ref = getDatabase(compiler, '/main.dbml').refs.find((r) => r.name === 'user_posts');
    expect(ref?.color).toBe('#222222');
    expect(ref?.metadata).toEqual({ owner: 'main', team: 'data' });
  });

  test('a ref is not a target where one of its endpoint tables is not visible', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': ORDERS,
      '/main.dbml': `
use { table users } from './orders.dbml'

Metadata Ref user_posts {
  color: #e67e22
}
`,
    });

    const errors = compiler.interpretFile(fp('/main.dbml')).getErrors();
    expect(errors.map((e) => e.diagnostic)).toContain('Cannot find metadata target element: `Ref user_posts`');
  });

  test('two visible files defining a ref with the same name make the target ambiguous', () => {
    const { compiler } = setupCompiler({
      '/tables.dbml': `
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
  author_id int
}
`,
      '/a.dbml': `
use * from './tables.dbml'
Ref r: posts.user_id > users.id
`,
      '/b.dbml': `
use * from './tables.dbml'
Ref r: posts.author_id > users.id
`,
      '/main.dbml': `
use * from './tables.dbml'
use * from './a.dbml'
use * from './b.dbml'

Metadata Ref r {
  color: #e67e22
}
`,
    });

    const errors = compiler.interpretFile(fp('/main.dbml')).getErrors();
    expect(errors.map((e) => e.code)).toContain(CompileErrorCode.BINDING_ERROR);
    expect(errors.map((e) => e.diagnostic)).toContain("Ref 'r' is ambiguous: it has multiple definitions");
  });

  test('a name defined in two files resolves when only one of the refs is visible', () => {
    const { compiler } = setupCompiler({
      '/tables.dbml': `
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
}
`,
      '/a.dbml': `
use * from './tables.dbml'
Ref r: posts.user_id > users.id
`,
      // main reaches b.dbml but never sees its comments table, so b's ref is not visible there
      '/b.dbml': `
use * from './tables.dbml'
Table comments {
  id int [pk]
  user_id int
}
Table tags {
  id int [pk]
}
Ref r: comments.user_id > users.id
`,
      '/main.dbml': `
use * from './tables.dbml'
use * from './a.dbml'
use { table tags } from './b.dbml'

Metadata Ref r {
  color: #e67e22
}
`,
    });

    const db = getDatabase(compiler, '/main.dbml');
    const r = db.refs.find((x) => x.name === 'r');
    expect(r?.endpoints.map((e) => e.tableName).sort()).toEqual(['posts', 'users']);
    expect(r?.color).toBe('#e67e22');
  });

  test('use * does not import ref names, so a local ref may reuse an imported ref name', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': ORDERS,
      '/main.dbml': `
use * from './orders.dbml'
Table comments {
  id int [pk]
  user_id int
}
Ref user_posts: comments.user_id > users.id
`,
    });

    const errors = compiler.interpretFile(fp('/main.dbml')).getErrors();
    expect(errors.map((e) => e.code)).not.toContain(CompileErrorCode.DUPLICATE_NAME);
  });

  test('ref-name completion suggests imported refs that are visible', () => {
    const main = `use * from './orders.dbml'

Metadata Ref `;
    const { compiler } = setupCompiler({
      '/orders.dbml': ORDERS,
      '/main.dbml': main,
    });

    const provider = new DBMLCompletionItemProvider(compiler);
    const model = createMockTextModel(main, fp('/main.dbml').toUri());
    const suggestions = provider.provideCompletionItems(model, createPosition(3, 14)).suggestions;
    expect(suggestions.map((s) => s.label)).toEqual(['user_posts']);
    expect(suggestions[0].detail).toBe('from orders.dbml');
  });
});
