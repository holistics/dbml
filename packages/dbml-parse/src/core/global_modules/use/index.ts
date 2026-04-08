import { SyntaxNode, UseDeclarationNode } from '@/core/parser/nodes';
import { GlobalModule } from '../types';
import Report from '@/core/report';
import Compiler from '@/compiler';
import { PASS_THROUGH, PassThrough } from '@/constants';
import { ImportKind, NodeSymbol, SchemaElement, UseSymbol } from '@/core/types';
import { isUseDeclaration, isUseSpecifier, isWildcardSpecifier } from '@/core/utils/expression';
import { resolveImportFilepath } from '@/core/types/filepath';

export const useModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    const useDeclaration = node.parentOfKind(UseDeclarationNode);
    const isReExport = useDeclaration?.isReExport;

    const rawFilepath = useDeclaration?.importPath?.value;
    const absolutePath = rawFilepath !== undefined ? resolveImportFilepath(node.filepath, rawFilepath) : undefined;

    if (isUseSpecifier(node)) {
      const kind = Object.values(ImportKind).find((k) => node.isKind(k));

      return Report.create(
        compiler.symbolFactory.create(
          UseSymbol,
          {
            absolutePath,
            importKind: kind,
            isReExport: isReExport!,
            declaration: node,
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
            isReExport: isReExport!,
            declaration: node,
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
