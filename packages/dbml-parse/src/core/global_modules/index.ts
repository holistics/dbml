import type { GlobalModule } from './types';
import { PASS_THROUGH, UNHANDLED, type PassThrough } from '@/constants';
import { tableModule } from './table';
import { refModule } from './ref';
import { projectModule } from './project';
import { tableGroupModule } from './tableGroup';
import { tablePartialModule } from './tablePartial';
import { noteModule } from './stickyNote';
import { enumModule } from './enum';
import { recordsModule } from './records';
import { indexesModule } from './indexes';
import { checksModule } from './checks';
import { programModule } from './program';
import { schemaModule } from './schema';
import { useModule } from './use';
import type Compiler from '@/compiler/index';
import type { SyntaxNode } from '@/core/parser/nodes';
import Report from '@/core/report';
import type { NodeSymbol } from '@/core/types/symbols';
import type { SchemaElement } from '@/core/types/schemaJson';
import type { Unhandled } from '@/constants';

// Registry of all element modules; the dispatcher tries each in order until one claims the node.
// Each time you add a new element, register its module here.
export const modules: GlobalModule[] = [
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
  useModule,
  schemaModule,
  programModule,
];

// Chain-of-responsibility: iterate modules until one handles the node (returns non-PASS_THROUGH)
function dispatch<K extends keyof GlobalModule> (
  method: K,
  ...args: Parameters<NonNullable<GlobalModule[K]>>
): ReturnType<NonNullable<GlobalModule[K]>> | Report<PassThrough> {
  for (const module of modules) {
    const fn = module[method] as any;
    if (fn) {
      const result = fn(...args);
      if (result instanceof Report && !result.hasValue(PASS_THROUGH)) {
        return result;
      }
    }
  }

  return Report.create(PASS_THROUGH);
}

export function nodeSymbol (this: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<Unhandled> {
  const res = dispatch('nodeSymbol', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function symbolMembers (this: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<Unhandled> {
  const res = dispatch('symbolMembers', this, symbol);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function nodeReferee (this: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<Unhandled> {
  const res = dispatch('nodeReferee', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function bindNode (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
  const res = dispatch('bindNode', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function interpretNode (this: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled> {
  const res = dispatch('interpretNode', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}
