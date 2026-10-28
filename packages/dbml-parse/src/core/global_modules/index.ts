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
import { depModule } from './dep';
import { diagramViewModule } from './diagramView';
import { enumModule } from './enum';
import { indexesModule } from './indexes';
import { programModule } from './program';
import { projectModule } from './project';
import { recordsModule } from './records';
import { refModule } from './ref';
import { schemaModule } from './schema';
import { noteModule } from './note';
import { metadataModule } from './metadata';
import { tableModule } from './table';
import { tableGroupModule } from './tableGroup';
import { tablePartialModule } from './tablePartial';
import type { GlobalModule } from './types';
import { useModule } from './use';

// Registry of all element modules, dispatcher tries each in order until one claims the node
// Register each new element module here
export const modules: GlobalModule[] = [
  // UseSymbol doesn't have a dedicated SymbolKind but uses kinds like Table, TableGroup, so it must be first
  useModule,
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
  const result = dispatch('nodeSymbol', this, node);
  return result.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : result;
}

export function symbolMembers (this: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<Unhandled> {
  const result = dispatch('symbolMembers', this, symbol);
  return result.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : result;
}

export function nodeReferee (this: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<Unhandled> {
  const result = dispatch('nodeReferee', this, node);
  return result.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : result;
}

export function bindNode (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
  const result = dispatch('bindNode', this, node);
  return result.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : result;
}

export function nodeMetadata (this: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<Unhandled> {
  const result = dispatch('nodeMetadata', this, node);
  return result.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : result;
}

export function interpretSymbol (this: Compiler, symbol: NodeSymbol, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled> {
  const result = dispatch('interpretSymbol', this, symbol, filepath);
  return result.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : result;
}

export function interpretMetadata (this: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled> {
  const result = dispatch('interpretMetadata', this, metadata, filepath);
  return result.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : result;
}
