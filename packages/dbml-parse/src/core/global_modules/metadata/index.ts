import type Compiler from '@/compiler/index';
import type { Filepath } from '@/core/types/filepath';
import { PASS_THROUGH, PassThrough } from '@/core/types/module';
import { MetadataDeclarationNode, SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { SchemaElement } from '@/core/types/schemaJson';
import type { NodeSymbol } from '@/core/types/symbol';
import { MetadataElementMetadata, NodeMetadata } from '@/core/types/symbol/metadata';
import { destructureComplexVariable } from '@/core/utils/expression';
import { isExpressionAVariableNode } from '@/core/utils/validate';
import type { GlobalModule } from '../types';

import MetadataBinder from './bind';
import MetadataInterpreter from './interpret';
import { resolveMetadataTarget } from './resolve';

export const metadataModule: GlobalModule = {
  // A Metadata element auto-attaches to its target element (like records/refs):
  // owners() returns every reachable program that can see the target, so it
  // travels with the target without an explicit import.
  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    if (!(node instanceof MetadataDeclarationNode)) return new Report(PASS_THROUGH);

    return new Report(new MetadataElementMetadata(node));
  },

  // Resolve the target identifier inside a Metadata header so go-to-definition
  // and reference highlighting jump to the annotated element.
  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) return new Report(PASS_THROUGH);

    const metadataNode = node.parentOfKind(MetadataDeclarationNode);
    if (!metadataNode) return new Report(PASS_THROUGH);
    // Only the header target name, not anything inside the body.
    if (!metadataNode.targetName?.containsEq(node)) return new Report(PASS_THROUGH);

    const nameParts = destructureComplexVariable(metadataNode.targetName);
    if (!nameParts) return new Report(undefined);

    const targetKind = metadataNode.getTargetKind();
    if (!targetKind) return new Report(undefined);

    const target = resolveMetadataTarget(compiler, metadataNode);
    return new Report(target);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!(node instanceof MetadataDeclarationNode)) return new Report(PASS_THROUGH);

    return new Report(undefined, new MetadataBinder(compiler, node).bind());
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!(metadata instanceof MetadataElementMetadata)) return new Report(PASS_THROUGH);

    if (!(metadata.declaration instanceof MetadataDeclarationNode)) return new Report(undefined);

    return new MetadataInterpreter(compiler, metadata, filepath).interpret();
  },
};
