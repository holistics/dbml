import {
  isProgramNode,
} from '@/core/utils/expression';
import {
  ProgramNode, type SyntaxNode,
} from '@/core/types/nodes';
import {
  NodeSymbol, SchemaSymbol, SymbolKind,
} from '@/core/types/symbol';
import type {
  GlobalModule,
} from '../types';
import {
  DEFAULT_SCHEMA_NAME, PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import {
  shouldInterpretNode,
} from '../utils';
import type {
  Database,
} from '@/core/types/schemaJson';
import Binder from './bind';
import ProgramInterpreter from './interpret';

export const programModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isProgramNode(node)) {
      return Report.create(PASS_THROUGH);
    }

    return Report.create(
      compiler.symbolFactory.create(
        NodeSymbol,
        {
          kind: SymbolKind.Program,
          declaration: node,
        },
        node.filepath,
      ),
    );
  },

  // Return all member symbols that are part of this program
  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Program)) {
      return Report.create(PASS_THROUGH);
    }

    const ast = symbol.declaration;
    if (!(ast instanceof ProgramNode)) return Report.create([]);

    // Collect and create schemas
    const schemaMembers = new Map<string, SchemaSymbol>([
      [
        DEFAULT_SCHEMA_NAME,
        compiler.symbolFactory.create(SchemaSymbol, {
          name: DEFAULT_SCHEMA_NAME,
        }, symbol.filepath),
      ],
    ]);

    for (const element of ast.body) {
      const fullname = compiler.nodeFullname(element).getValue();
      if (!Array.isArray(fullname)) continue; // No schema here

      const schemaName = fullname.length <= 1 ? DEFAULT_SCHEMA_NAME : fullname[0]; // When fullname doesn't have a schema name, `public` is assumed
      if (!schemaMembers.has(schemaName)) {
        schemaMembers.set(schemaName, compiler.symbolFactory.create(SchemaSymbol, {
          name: schemaName,
        }, symbol.filepath));
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

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new Binder(node, compiler).resolve();
  },

  interpretNode (compiler: Compiler, node: SyntaxNode): Report<Database | undefined> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined, [...compiler.validateNode(node).getErrors(), ...compiler.bindNode(node).getErrors()],
    );

    return new ProgramInterpreter(compiler, node).interpret() as Report<Database | undefined>;
  },
};
