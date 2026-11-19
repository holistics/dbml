import type Compiler from '@/compiler/index';
import type { Filepath } from '@/core/types/filepath';
import { PASS_THROUGH, PassThrough } from '@/core/types/module';
import { ElementDeclarationNode, SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { SchemaElement } from '@/core/types/schemaJson';
import type { NodeSymbol } from '@/core/types/symbol';
import { MetadataElementMetadata, NodeMetadata } from '@/core/types/symbol/metadata';
import { isElementNode, isExpressionAVariableNode } from '@/core/utils/validate';
import { ElementKind } from '@/core/types';

import MetadataBinder from './bind';
import MetadataInterpreter from './interpret';
import { metadataHeaderTargets } from './utils';
import type { GlobalModule } from '../types';

export const metadataModule: GlobalModule = {
  /** A metadata element does not have its own settings/metadata */
  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return new Report(PASS_THROUGH);

    return new Report(new MetadataElementMetadata(node));
  },

  // Resolve the target element
  // Resolve to none if there are 0 or 2+ matching targets
  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) return new Report(PASS_THROUGH);

    const metadataNode = node.parentOfKind(ElementDeclarationNode);
    if (!metadataNode || !isElementNode(metadataNode, ElementKind.Metadata)) return new Report(PASS_THROUGH);

    // Only the header target name, not anything inside the body
    if (!metadataNode.name?.containsEq(node)) return new Report(PASS_THROUGH);

    const targets = metadataHeaderTargets(compiler, node);
    // A Target that is not a symbol (a named Ref/Dep) is not a symbol reference
    return new Report(targets.length === 1 && !(targets[0] instanceof NodeMetadata) ? targets[0] : undefined);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return new Report(PASS_THROUGH);

    return new Report(undefined, new MetadataBinder(compiler, node).bind());
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!(metadata instanceof MetadataElementMetadata)) return new Report(PASS_THROUGH);

    if (!isElementNode(metadata.declaration, ElementKind.Metadata)) return new Report(undefined);

    return new MetadataInterpreter(compiler, metadata, filepath).interpret();
  },
};
