import type Compiler from '@/compiler/index';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  ProgramNode, type SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  NodeSymbol, ProgramSymbol, SchemaSymbol, SymbolKind,
} from '@/core/types/symbol';
import {
  isProgramNode,
} from '@/core/utils/validate';
import type {
  GlobalModule,
} from '../types';
import {
  shouldInterpretNode,
} from '../utils';
import Binder from './bind';
import ProgramInterpreter from './interpret';

export const programModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isProgramNode(node)) {
      return Report.create(PASS_THROUGH);
    }

    return Report.create(
      compiler.symbolFactory.create(
        ProgramSymbol,
        {
          declaration: node,
          name: node.filepath.absolute,
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

    for (const element of ast.declarations) {
      const fullname = compiler.nodeFullname(element).getFiltered(UNHANDLED) || [];

      const schemaName = fullname.length <= 1 ? DEFAULT_SCHEMA_NAME : fullname[0]; // When fullname doesn't have a schema name, `public` is assumed
      if (!schemaMembers.has(schemaName)) {
        schemaMembers.set(schemaName, compiler.symbolFactory.create(SchemaSymbol, {
          name: schemaName,
        }, symbol.filepath));
      }
    }

    // Create all schemas in reachable files
    for (const filepath of compiler.reachableFiles(symbol.filepath)) {
      const {
        schemaMembers: schemas,
      } = compiler.usableMembers(filepath).getValue();
      for (const schema of schemas) {
        const {
          name,
        } = schema;
        if (!schemaMembers.has(name)) {
          schemaMembers.set(name, compiler.symbolFactory.create(SchemaSymbol, {
            name,
          }, symbol.filepath));
        }
      }
    }

    // Public schema's members are also visible in the Program symbol
    const publicSymbol = schemaMembers.get(DEFAULT_SCHEMA_NAME);
    if (!publicSymbol) return Report.create([
      ...schemaMembers.values(),
    ]);
    const publicMembers = compiler.symbolMembers(publicSymbol).getFiltered(UNHANDLED)?.filter((s) => !s.isKind(SymbolKind.Schema)); // Do not include nested schema
    if (!publicMembers) return Report.create([
      ...schemaMembers.values(),
    ]);
    return Report.create([
      ...schemaMembers.values(),
      ...publicMembers,
    ]);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isProgramNode(node)) return Report.create(PASS_THROUGH);
    return new Binder(node, compiler).resolve();
  },

  interpretSymbol (compiler: Compiler, symbol: NodeSymbol, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!(symbol instanceof ProgramSymbol)) return Report.create(PASS_THROUGH);
    if (!(symbol.declaration instanceof ProgramNode)) return Report.create(undefined);

    if (!shouldInterpretNode(compiler, symbol.declaration)) {
      return Report.create(undefined, [
        ...compiler.validateNode(symbol.declaration).getErrors(),
        ...compiler.bindNode(symbol.declaration).getErrors(),
      ]);
    }

    return new ProgramInterpreter(compiler, symbol, filepath).interpret() as Report<SchemaElement | SchemaElement[] | undefined>;
  },
};
