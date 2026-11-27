import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/core/types/errors';
import { setupCompiler, fp } from './utils';

// `/main.dbml` imports `/a.dbml` and `/b.dbml`, which both import `/shared.dbml` (a diamond)
function diamond (sharedDep: string) {
  return setupCompiler({
    '/shared.dbml': `
Table raw_orders { id int }
Table stg_orders { id int }
${sharedDep}
`,
    '/a.dbml': 'use * from \'./shared.dbml\'\n',
    '/b.dbml': 'use * from \'./shared.dbml\'\n',
    '/main.dbml': 'use * from \'./a.dbml\'\nuse * from \'./b.dbml\'\n',
  }).compiler;
}

describe('[example] multifile - deprecated unquoted Dep value', () => {
  const bareDep = 'Dep pipeline {\n  raw_orders -> stg_orders\n  owner: data team\n}';

  test('interpretProject reports the warning once', () => {
    const compiler = diamond(bareDep);
    const report = compiler.interpretProject();
    expect(report.getErrors()).toEqual([]);
    expect(report.getWarnings().map((w) => [w.code, w.filepath.absolute])).toEqual([
      [CompileErrorCode.DEPRECATED_DEP_SETTING_VALUE, '/shared.dbml'],
    ]);
  });

  test.each(['/shared.dbml', '/a.dbml', '/main.dbml'])('interpretFile(%s) reports the warning once', (path) => {
    const compiler = diamond(bareDep);
    const report = compiler.interpretFile(fp(path));
    expect(report.getErrors()).toEqual([]);
    expect(report.getWarnings().map((w) => w.code)).toEqual([CompileErrorCode.DEPRECATED_DEP_SETTING_VALUE]);
  });

  test('interpretProject reports an error in the shared file once', () => {
    const compiler = diamond('Dep pipeline {\n  raw_orders -> stg_orders\n  owner: a.b\n}');
    const errors = compiler.interpretProject().getErrors()
      .filter((e) => e.code === CompileErrorCode.INVALID_DEP_SETTING_VALUE);
    expect(errors).toHaveLength(1);
  });
});
