import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, MetadataDeclarationNode, SyntaxNode,
} from '@/core/types/nodes';
import { resolveMetadataTarget } from './resolve';
import { destructureComplexVariable } from '@/core/utils/expression';

export default class MetadataBinder {
  constructor (private compiler: Compiler, private declarationNode: MetadataDeclarationNode) {}

  bind (): CompileError[] {
    return [
      ...this.bindTargetElement(this.declarationNode.targetName),
      ...this.bindBody(this.declarationNode.body),
    ];
  }

  private bindTargetElement (nameNode?: SyntaxNode): CompileError[] {
    // The target kind must be valid (table/tablegroup/... - handled at validator) before we attempt to resolve the target.
    const targetKind = this.declarationNode.getTargetKind();
    const nameParts = destructureComplexVariable(nameNode);
    if (!nameParts?.length || !targetKind) return [];

    const target = resolveMetadataTarget(this.compiler, this.declarationNode);

    if (!target) {
      return [
        new CompileError(
          CompileErrorCode.BINDING_ERROR,
          'cannot find metadata target element',
          nameNode ?? this.declarationNode,
        ),
      ];
    }

    return [];
  }

  private bindBody (body?: BlockExpressionNode | FunctionApplicationNode): CompileError[] {
    if (!(body instanceof BlockExpressionNode)) return [];

    const subs = body.body.filter((e) => e instanceof ElementDeclarationNode);
    return (subs).flatMap((sub) => {
      if (!sub.type) return [];

      return this.compiler.bindNode(sub).getErrors();
    });
  }
}
