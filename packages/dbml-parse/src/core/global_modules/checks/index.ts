import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  TableChecksMetadata, MetadataKind,
} from '@/core/types/symbol/metadata';
import type {
  NodeMetadata,
} from '@/core/types/symbol/metadata';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import {
  ElementDeclarationNode, type SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import type {
  GlobalModule,
} from '../types';
import ChecksBinder from './bind';
import ChecksInterpreter from './interpret';
import {
  isElementNode,
} from '@/core/utils/validate';

export const checksModule: GlobalModule = {
  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    // Standalone checks block
    if (isElementNode(node, ElementKind.Checks)) {
      const tableNode = node.parent;
      if (!tableNode || (!isElementNode(tableNode, ElementKind.Table) && !isElementNode(tableNode, ElementKind.TablePartial))) return Report.create(PASS_THROUGH);
      return Report.create(new TableChecksMetadata(node));
    }

    return Report.create(PASS_THROUGH);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new ChecksBinder(compiler, node).bind(),
    );
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (metadata.kind === MetadataKind.TableChecks) {
      if (!(metadata.declaration instanceof ElementDeclarationNode)) return Report.create(undefined);
      return new ChecksInterpreter(compiler, metadata.declaration).interpret();
    }

    return Report.create(PASS_THROUGH);
  },
};
