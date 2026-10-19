import type Compiler from '@/compiler';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED, type Unhandled,
} from '@/core/types/module';
import type { SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { checksModule } from './checks';
import { customModule } from './custom';
import { depModule } from './dep';
import { diagramViewModule } from './diagramView';
import { enumModule } from './enum';
import { indexesModule } from './indexes';
import { noteModule } from './note';
import { metadataModule } from './metadata';
import { programModule } from './program';
import { projectModule } from './project';
import { recordsModule } from './records';
import { refModule } from './ref';
import { tableModule } from './table';
import { tableGroupModule } from './tableGroup';
import { tablePartialModule } from './tablePartial';
import type { LocalModule, Settings } from './types';
import { useModule } from './use';
import { archModule } from './arch';

// Each time you add a new element, register its module here.
export const modules: LocalModule[] = [
  tableModule,
  enumModule,
  recordsModule,
  indexesModule,
  checksModule,
  refModule,
  depModule,
  projectModule,
  tableGroupModule,
  tablePartialModule,
  noteModule,
  metadataModule,
  diagramViewModule,
  programModule,
  useModule,
  customModule,
];

// The local modules of an architecture file
export const archModules: LocalModule[] = [
  archModule,
  programModule,
  useModule,
];

// Chain-of-responsibility: iterate the node's file's modules until one handles the node (returns non-PASS_THROUGH)
function dispatch<K extends keyof LocalModule> (
  method: K,
  ...args: Parameters<NonNullable<LocalModule[K]>>
): ReturnType<NonNullable<LocalModule[K]>> | Report<PassThrough> {
  const [
    compiler,
    node,
  ] = args as unknown as [Compiler, SyntaxNode];
  const list = !compiler.explicitModules && compiler.parsedFileKind(node.filepath) === 'arch' ? archModules : modules;
  for (const module of list) {
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
