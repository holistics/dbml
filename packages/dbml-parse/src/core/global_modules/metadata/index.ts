import type Compiler from '@/compiler/index';
import type { Filepath } from '@/core/types/filepath';
import { ElementKind } from '@/core/types/keywords';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { ElementDeclarationNode, ProgramNode, type SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { SchemaElement } from '@/core/types/schemaJson';
import type { NodeSymbol } from '@/core/types/symbol';
import { MetadataElementMetadata, type NodeMetadata } from '@/core/types/symbol/metadata';
import { destructureComplexVariable } from '@/core/utils/expression';
import { getElementSubKind, isElementNode, isExpressionAVariableNode } from '@/core/utils/validate';
import type { GlobalModule } from '../types';

import MetadataBinder from './bind';
import MetadataInterpreter from './interpret';
import { resolveMetadataTarget } from './resolve';

export const metadataModule: GlobalModule = {
  // A Metadata element auto-attaches to its target element (like records/refs):
  // owners() returns every reachable program that can see the target, so it
  // travels with the target without an explicit import.
  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata) || !(node.parentNode instanceof ProgramNode)) return Report.create(PASS_THROUGH);

    return Report.create(new MetadataElementMetadata(node as ElementDeclarationNode));
  },

  // Resolve the target identifier inside a Metadata header so go-to-definition
  // and reference highlighting jump to the annotated element.
  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) return Report.create(PASS_THROUGH);

    const metadataNode = node.parentOfKind(ElementDeclarationNode);
    if (!metadataNode?.isKind(ElementKind.Metadata)) return Report.create(PASS_THROUGH);
    // Only the header name (target), not anything inside the body.
    if (!metadataNode.name?.containsEq(node)) return Report.create(PASS_THROUGH);

    const nameParts = destructureComplexVariable(metadataNode.name);
    if (!nameParts) return Report.create(undefined);

    const subKind = getElementSubKind(metadataNode.getElementKind(), metadataNode.subKind);
    if (!subKind) return Report.create(undefined);

    const target = resolveMetadataTarget(compiler, metadataNode);
    return Report.create(target);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return Report.create(PASS_THROUGH);

    return Report.create(undefined, new MetadataBinder(compiler, node).bind());
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!(metadata instanceof MetadataElementMetadata)) return Report.create(PASS_THROUGH);
    if (!(metadata.declaration instanceof ElementDeclarationNode)) return Report.create(undefined);
    return new MetadataInterpreter(compiler, metadata, filepath).interpret();
  },
};
