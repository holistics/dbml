import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/index';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { createMockTextModel, createPosition } from '../../../utils';
import { getDatabase, setupCompiler, fp } from './utils';

const ORDERS = `
Table raw_orders {
  id int [pk]
}
Table stg_orders {
  id int [pk]
}
Dep pipeline {
  raw_orders -> stg_orders
  owner: 'orders'
  sla: 3
}
`;

describe('[example] multifile interpreter - Metadata Dep', () => {
  test('the importer restyles an imported dep without changing the defining file', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': ORDERS,
      '/reporting.dbml': `
use * from './orders.dbml'

Metadata Dep pipeline {
  color: #e67e22
  note: 'Nightly'
  owner: 'reporting'
}
`,
    });

    const reporting = getDatabase(compiler, '/reporting.dbml').deps.find((d) => d.name === 'pipeline');
    expect(reporting?.color).toBe('#e67e22');
    expect(reporting?.note?.value).toBe('Nightly');
    expect(reporting?.metadata).toEqual({ owner: 'reporting', sla: 3 });

    const orders = getDatabase(compiler, '/orders.dbml').deps.find((d) => d.name === 'pipeline');
    expect(orders?.color).toBeUndefined();
    expect(orders?.note).toBeUndefined();
    expect(orders?.metadata).toEqual({ owner: 'orders', sla: 3 });
  });

  test('same-file target', () => {
    const { compiler } = setupCompiler({
      '/main.dbml': `${ORDERS}
Metadata Dep pipeline {
  color: #abc
}
`,
    });

    const dep = getDatabase(compiler, '/main.dbml').deps.find((d) => d.name === 'pipeline');
    expect(dep?.color).toBe('#abc');
  });

  test('a block overrides inline keys case-insensitively and inline color/note; other inline values survive', () => {
    const { compiler } = setupCompiler({
      '/main.dbml': `
Table a { id int }
Table b { id int }
Dep d [color: #111111, note: 'inline', Owner: 'inline'] {
  a -> b
  sla: 3
}

Metadata Dep d {
  color: #222222
  note: 'block'
  owner: 'block'
}
`,
    });

    const dep = getDatabase(compiler, '/main.dbml').deps.find((d) => d.name === 'd');
    expect(dep?.color).toBe('#222222');
    expect(dep?.note?.value).toBe('block');
    expect(dep?.metadata).toEqual({ owner: 'block', sla: 3 });
  });

  test('precedence: importer outranks imported', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': ORDERS,
      '/enrichment.dbml': `
use * from './orders.dbml'

Metadata Dep pipeline {
  color: #222222
  owner: 'enrichment'
  team: 'data'
}
`,
      '/main.dbml': `
use * from './enrichment.dbml'
use * from './orders.dbml'

Metadata Dep pipeline {
  owner: 'main'
}
`,
    });

    const dep = getDatabase(compiler, '/main.dbml').deps.find((d) => d.name === 'pipeline');
    expect(dep?.color).toBe('#222222');
    expect(dep?.metadata).toEqual({ owner: 'main', team: 'data', sla: 3 });
  });

  test('a dep is not a target where an endpoint table of any edge is not visible', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': `
Table raw_orders { id int }
Table stg_orders { id int }
Table raw_users { id int }
Table stg_users { id int }
Dep multi {
  raw_orders -> stg_orders
  raw_users -> stg_users
}
`,
      '/main.dbml': `
use { table raw_orders } from './orders.dbml'
use { table stg_orders } from './orders.dbml'
use { table raw_users } from './orders.dbml'

Metadata Dep multi {
  color: #e67e22
}
`,
    });

    const errors = compiler.interpretFile(fp('/main.dbml')).getErrors();
    expect(errors.map((e) => e.diagnostic)).toContain('Cannot find metadata target element: `Dep multi`');
  });

  test('two visible files defining a dep with the same name make the target ambiguous', () => {
    const { compiler } = setupCompiler({
      '/tables.dbml': `
Table a { id int }
Table b { id int }
Table c { id int }
`,
      '/x.dbml': `
use * from './tables.dbml'
Dep d { a -> b }
`,
      '/y.dbml': `
use * from './tables.dbml'
Dep d { b -> c }
`,
      '/main.dbml': `
use * from './tables.dbml'
use * from './x.dbml'
use * from './y.dbml'

Metadata Dep d {
  color: #e67e22
}
`,
    });

    const errors = compiler.interpretFile(fp('/main.dbml')).getErrors();
    expect(errors.map((e) => e.code)).toContain(CompileErrorCode.BINDING_ERROR);
    expect(errors.map((e) => e.diagnostic)).toContain("Dep 'd' is ambiguous: it has multiple definitions");
  });

  test('a block on an unnamed dep cannot find a target', () => {
    const { compiler } = setupCompiler({
      '/main.dbml': `
Table a { id int }
Table b { id int }
Dep {
  a -> b
}

Metadata Dep nope {
  color: #e67e22
}
`,
    });

    const errors = compiler.interpretFile(fp('/main.dbml')).getErrors();
    expect(errors.map((e) => e.diagnostic)).toContain('Cannot find metadata target element: `Dep nope`');
  });

  test('dep-name completion suggests imported deps that are visible', () => {
    const main = `use * from './orders.dbml'

Metadata Dep `;
    const { compiler } = setupCompiler({
      '/orders.dbml': ORDERS,
      '/main.dbml': main,
    });

    const provider = new DBMLCompletionItemProvider(compiler);
    const model = createMockTextModel(main, fp('/main.dbml').toUri());
    const suggestions = provider.provideCompletionItems(model, createPosition(3, 14)).suggestions;
    expect(suggestions.map((s) => s.label)).toEqual(['pipeline']);
    expect(suggestions[0].detail).toBe('from orders.dbml');
  });
});
