import type Compiler from '@/compiler/index';
import type { Filepath } from '@/core/types/filepath';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED, Unhandled,
} from '@/core/types/module';
import type { SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { NodeMetadata } from '@/core/types/symbol/metadata';
import type { SchemaElement } from '@/core/types/schemaJson';
import type { NodeSymbol } from '@/core/types/symbol';
import { checksModule } from './checks';
import { diagramViewModule } from './diagramView';
import { enumModule } from './enum';
import { indexesModule } from './indexes';
import { programModule } from './program';
import { projectModule } from './project';
import { recordsModule } from './records';
import { refModule } from './ref';
import { schemaModule } from './schema';
import { noteModule } from './note';
import { tableModule } from './table';
import { tableGroupModule } from './tableGroup';
import { tablePartialModule } from './tablePartial';
import type { GlobalModule } from './types';
import { useModule } from './use';

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
  diagramViewModule,
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

export function nodeMetadata (this: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<Unhandled> {
  const res = dispatch('nodeMetadata', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function interpretSymbol (this: Compiler, symbol: NodeSymbol, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled> {
  const res = dispatch('interpretSymbol', this, symbol, filepath);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function interpretMetadata (this: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled> {
  const res = dispatch('interpretMetadata', this, metadata, filepath);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}
