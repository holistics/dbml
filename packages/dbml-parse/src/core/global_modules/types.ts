import type { PassThrough } from '@/constants';
import type Compiler from '@/compiler/index';
import type { SyntaxNode } from '@/core/types/nodes';
import type { NodeSymbol, SymbolKind } from '../types/symbol';
import type Report from '@/core/types/report';
import type { SchemaElement } from '../types/schemaJson';
import type { Module } from '../types/module';

// Modules decouple element-specific logic from the compiler: each module handles one DBML element kind
// (table, enum, ref, etc.) and the compiler dispatches to them via a chain-of-responsibility pattern.
// All methods are optional, missing methods are treated as returning PASS_THROUGH.
export interface GlobalModule extends Module {
  // Produce the unique symbol identity for this AST node
  nodeSymbol? (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough>;
  // List the direct child symbols owned by this symbol (e.g. columns of a table)
  // for schemas: including the used symbols
  symbolMembers? (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough>;
  // Resolve the symbol that this reference node points to
  nodeReferee? (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough>;
  // Resolve cross-references for this node (e.g. link ref endpoints to their target columns)
  bindNode? (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough>;
  // Convert this AST node into its schema JSON representation
  interpretNode? (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough>;
}
