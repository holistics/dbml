import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  MetadataKind,
} from '@/core/types/metadata';
import type {
  CheckMetadata, SymbolMetadata,
} from '@/core/types/metadata';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  ElementDeclarationNode, FunctionApplicationNode, type SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  getBody,
} from '@/core/utils/expression';
import type {
  GlobalModule,
} from '../types';
import ChecksBinder from './bind';
import ChecksInterpreter from './interpret';
import {
  isElementNode,
} from '@/core/utils/validate';

export const checksModule: GlobalModule = {
  emitMetadata (compiler: Compiler, node: SyntaxNode): Report<SymbolMetadata[]> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);

    const tableNode = node.parent;
    if (!tableNode || (!isElementNode(tableNode, ElementKind.Table) && !isElementNode(tableNode, ElementKind.TablePartial))) return Report.create(PASS_THROUGH);

    const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
    if (!tableSymbol) return Report.create(PASS_THROUGH);

    const body = getBody(node as ElementDeclarationNode);
    const results: CheckMetadata[] = [];

    for (const field of body) {
      if (!(field instanceof FunctionApplicationNode)) continue;

      const expression = field.callee?.toString() ?? '';

      results.push({
        kind: MetadataKind.Check,
        target: tableSymbol,
        expression,
        declaration: node,
      });
    }

    return Report.create(results);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new ChecksBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretMetadata (compiler: Compiler, metadata: SymbolMetadata): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (metadata.kind !== MetadataKind.Check) return Report.create(PASS_THROUGH);
    if (!(metadata.declaration instanceof ElementDeclarationNode)) return Report.create(undefined);

    return new ChecksInterpreter(compiler, metadata.declaration as ElementDeclarationNode & { type: SyntaxToken }).interpret();
  },
};
