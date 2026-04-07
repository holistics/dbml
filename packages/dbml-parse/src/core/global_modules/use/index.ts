import { CompileError, CompileErrorCode } from '@/core/errors';
import { SyntaxNode, UseDeclarationNode } from '@/core/parser/nodes';
import { GlobalModule } from '../types';
import Report from '@/core/report';
import Compiler from '@/compiler';
import { PASS_THROUGH, PassThrough, UNHANDLED } from '@/constants';
import { ImportKind, NodeSymbol, SchemaElement, UseSpecifierPatternKind, UseSymbol } from '@/core/types';
import { isUseSpecifier, isWildcardSpecifier } from '@/core/utils/expression';
import { resolveImportFilepath } from '@/core/types/filepath';

export const useModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    const filepath = node.parentOfKind(UseDeclarationNode)?.importPath?.value;
    const absolutePath = filepath !== undefined ? resolveImportFilepath(node.filepath, filepath) : undefined;

    if (isUseSpecifier(node)) {
      const kind = Object.values(ImportKind).find((k) => node.isKind(k));

      return Report.create(
        compiler.symbolFactory.create(
          UseSymbol,
          {
            absolutePath,
            specifier: {
              type: UseSpecifierPatternKind.Exact,
              importKind: kind,
              fullname: compiler.fullname(node).getFiltered(UNHANDLED),
            },
          },
          node.filepath,
        ),
      );
    }
    if (isWildcardSpecifier(node)) {
      return Report.create(
        compiler.symbolFactory.create(
          UseSymbol,
          {
            absolutePath,
            specifier: {
              type: UseSpecifierPatternKind.All,
            },
          },
          node.filepath,
        ),
      );
    }
    return Report.create(PASS_THROUGH);
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    return Report.create(PASS_THROUGH);
  },

  nestedSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> | Report<PassThrough> {
    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    return Report.create(PASS_THROUGH);
  },

  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    return Report.create(PASS_THROUGH);
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    return Report.create(PASS_THROUGH);
  },
};
