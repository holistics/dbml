import { isProgramNode } from '@/core/utils/expression';
import { ProgramNode, type SyntaxNode } from '@/core/parser/nodes';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { DEFAULT_SCHEMA_NAME, PASS_THROUGH, type PassThrough, UNHANDLED } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler/index';
import { getNodeMemberSymbols } from '../utils';
import type { Database } from '@/core/types/schemaJson';
import Binder from './bind';
import ProgramInterpreter from './interpret';

export const programModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isProgramNode(node)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report(compiler.symbolFactory.create(NodeSymbol, {
      kind: SymbolKind.Program,
      declaration: node,
    }));
  },

  nestedSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!isProgramNode(node)) {
      return Report.create(PASS_THROUGH);
    }
    return getNodeMemberSymbols(compiler, node);
  },

  // Return all member symbols that are part of this program
  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Program)) {
      return Report.create(PASS_THROUGH);
    }

    const ast = symbol.declaration;
    if (!(ast instanceof ProgramNode)) return Report.create([]);

    const schemaMembers = new Map<string, SchemaSymbol>();
    for (const element of ast.body) {
      const fullname = compiler.fullname(element).getValue();
      if (!Array.isArray(fullname)) continue; // No schema here

      const schemaName = fullname.length <= 1 ? DEFAULT_SCHEMA_NAME : fullname[0]; // When fullname doesn't have a schema name, `public` is assumed
      if (!schemaMembers.has(schemaName)) {
        schemaMembers.set(schemaName, compiler.symbolFactory.create(SchemaSymbol, { name: schemaName }));
      }
    }

    // Flatten public schema members into program members for lookups.
    // Errors are NOT propagated - the binder collects them by walking schemas explicitly.
    const publicSymbol = schemaMembers.get(DEFAULT_SCHEMA_NAME);
    if (!publicSymbol) return Report.create([...schemaMembers.values()]);
    const publicMembers = compiler.symbolMembers(publicSymbol);
    if (publicMembers.hasValue(UNHANDLED)) return Report.create([...schemaMembers.values()]);
    return Report.create([...schemaMembers.values(), ...publicMembers.getValue()]);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> { return Report.create(PASS_THROUGH); },

  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new Binder(node, compiler).resolve();
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<Database | undefined> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new ProgramInterpreter(compiler, node).interpret() as Report<Database | undefined>;
  },
};
