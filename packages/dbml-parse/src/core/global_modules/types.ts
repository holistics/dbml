import type Compiler from '@/compiler/index';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  SymbolMetadata,
} from '@/core/types/metadata';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import type Report from '@/core/types/report';
import type {
  Module, PassThrough,
} from '../types/module';
import type {
  SchemaElement,
} from '../types/schemaJson';
import type {
  NodeSymbol,
} from '../types/symbol';

export interface GlobalModule extends Module {
  nodeSymbol? (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough>;
  symbolMembers? (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough>;
  nodeReferee? (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough>;
  // Emit metadata (refs, checks, indexes, records) from this AST node, targeting symbols
  emitMetadata? (compiler: Compiler, node: SyntaxNode): Report<SymbolMetadata[]> | Report<PassThrough>;
  bindNode? (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough>;
  interpretSymbol? (compiler: Compiler, symbol: NodeSymbol, filepath?: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough>;
  interpretMetadata? (compiler: Compiler, metadata: SymbolMetadata, filepath?: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough>;
}
