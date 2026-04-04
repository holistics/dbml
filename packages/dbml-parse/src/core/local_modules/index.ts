import { PASS_THROUGH, type PassThrough, type Unhandled, UNHANDLED } from '@/constants';
import type { LocalModule, Settings } from './types';
import { tableModule } from './table';
import { enumModule } from './enum';
import { recordsModule } from './records';
import { indexesModule } from './indexes';
import { checksModule } from './checks';
import { customModule } from './custom';
import { refModule } from './ref';
import { projectModule } from './project';
import { tableGroupModule } from './tableGroup';
import { tablePartialModule } from './tablePartial';
import { noteModule } from './note';
import { programModule } from './program';
import type Compiler from '@/compiler';
import type { SyntaxNode } from '@/core/parser/nodes';
import Report from '@/core/report';

// Each time you add a new element, register its module here.
export const modules: LocalModule[] = [
  tableModule,
  enumModule,
  recordsModule,
  indexesModule,
  checksModule,
  refModule,
  projectModule,
  tableGroupModule,
  tablePartialModule,
  noteModule,
  programModule,
  customModule,
];

// Chain-of-responsibility: iterate modules until one handles the node (returns non-PASS_THROUGH)
function dispatch<K extends keyof LocalModule> (
  method: K,
  ...args: Parameters<NonNullable<LocalModule[K]>>
): ReturnType<NonNullable<LocalModule[K]>> | Report<PassThrough> {
  for (const module of modules) {
    const fn = module[method] as any;
    if (fn) {
      const result = fn(...args);
      if (!result.hasValue(PASS_THROUGH)) {
        return result;
      }
    }
  }

  return Report.create(PASS_THROUGH);
}

export function validate (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
  const res = dispatch('validate', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function settings (this: Compiler, node: SyntaxNode): Report<Settings> | Report<Unhandled> {
  const res = dispatch('settings', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function nodeFullname (this: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<Unhandled> {
  const res = dispatch('fullname', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function alias (this: Compiler, node: SyntaxNode): Report<string | undefined> | Report<Unhandled> {
  const res = dispatch('alias', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}
