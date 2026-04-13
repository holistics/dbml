import type {
  LocalModule, Settings,
} from './types';
import {
  tableModule,
} from './table';
import {
  enumModule,
} from './enum';
import {
  recordsModule,
} from './records';
import {
  indexesModule,
} from './indexes';
import {
  checksModule,
} from './checks';
import {
  customModule,
} from './custom';
import {
  refModule,
} from './ref';
import {
  projectModule,
} from './project';
import {
  tableGroupModule,
} from './tableGroup';
import {
  tablePartialModule,
} from './tablePartial';
import {
  noteModule,
} from './note';
import {
  programModule,
} from './program';
import {
  useModule,
} from './use';
import {
  diagramViewModule,
} from './diagramView';
import type Compiler from '@/compiler';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  PASS_THROUGH, type PassThrough, type Unhandled, UNHANDLED,
} from '@/core/types/module';

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
  diagramViewModule,
  programModule,
  useModule,
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

export function validateNode (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
  const res = dispatch('validateNode', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function nodeSettings (this: Compiler, node: SyntaxNode): Report<Settings> | Report<Unhandled> {
  const res = dispatch('nodeSettings', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function nodeFullname (this: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<Unhandled> {
  const res = dispatch('nodeFullname', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function nodeAlias (this: Compiler, node: SyntaxNode): Report<string | undefined> | Report<Unhandled> {
  const res = dispatch('nodeAlias', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}
