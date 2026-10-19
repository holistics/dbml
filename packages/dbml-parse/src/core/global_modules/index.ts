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
import { archModule } from './arch';

/**
 * The DBML vocabulary: the modules a Compiler uses when nobody says otherwise.
 *
 * The dispatcher tries each in order until one claims the node, so order is meaningful. Each
 * time you add a new DBML element, register its module here.
 *
 * A Compiler may also be built with a different list (see `Compiler`'s second argument). The
 * lexer and the parser do not know this vocabulary at all: `parser.ts` has one generic
 * `elementDeclaration()` and never mentions `ElementKind`, so another dialect is a different
 * array, not a different grammar. Pass a different list and the same front end binds a
 * different language, which is how the architecture dialect reuses all of this without forking
 * it or widening DBML's own vocabulary by a single word.
 */
export const dbmlModules: GlobalModule[] = [
  // UseSymbol doesn't have dedicated SymbolKind but use kinds like Table, TableGroup, ...
  // so make it the first module to claim the UseSymbol
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

// The modules of an architecture file. `use`, schema and program are shared with DBML.
export const archModules: GlobalModule[] = [
  archModule,
  useModule,
  schemaModule,
  programModule,
];

// A node, symbol or metadata is handled by the modules of the file that declares it
function modulesFor (compiler: Compiler, target: unknown): GlobalModule[] {
  if (compiler.explicitModules) return compiler.explicitModules;
  const filepath = (target as { filepath?: Filepath }).filepath
    ?? (target as { declaration?: SyntaxNode }).declaration?.filepath;
  return filepath && compiler.parsedFileKind(filepath) === 'arch' ? archModules : dbmlModules;
}

// Chain-of-responsibility: iterate the modules until one handles the node
function dispatch<K extends keyof GlobalModule> (
  compiler: Compiler,
  method: K,
  ...args: Parameters<NonNullable<GlobalModule[K]>>
): ReturnType<NonNullable<GlobalModule[K]>> | Report<PassThrough> {
  for (const module of modulesFor(compiler, args[1])) {
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
  const res = dispatch(this, 'nodeSymbol', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function symbolMembers (this: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<Unhandled> {
  const res = dispatch(this, 'symbolMembers', this, symbol);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function nodeReferee (this: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<Unhandled> {
  const res = dispatch(this, 'nodeReferee', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function bindNode (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
  const res = dispatch(this, 'bindNode', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function nodeMetadata (this: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<Unhandled> {
  const res = dispatch(this, 'nodeMetadata', this, node);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function interpretSymbol (this: Compiler, symbol: NodeSymbol, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled> {
  const res = dispatch(this, 'interpretSymbol', this, symbol, filepath);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}

export function interpretMetadata (this: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled> {
  const res = dispatch(this, 'interpretMetadata', this, metadata, filepath);
  return res.hasValue(PASS_THROUGH) ? Report.create(UNHANDLED) : res;
}
