import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
} from '@/core/types/nodes';
import { destructureComplexVariable } from '@/core/utils/expression';
import { getMetadataTargetKind } from '@/core/local_modules/metadata/utils';
import { resolveMetadataTarget } from './utils';

export default class MetadataBinder {
  constructor (private compiler: Compiler, private declarationNode: ElementDeclarationNode) {}

  bind (): CompileError[] {
    return [
      ...this.bindTargetElement(this.declarationNode.name),
      ...this.bindBody(this.declarationNode.body),
    ];
  }

  private bindTargetElement (nameNode?: SyntaxNode): CompileError[] {
    // The target kind must be valid (table/tablegroup/... - handled at validator) before we attempt to resolve the target.
    const targetKind = getMetadataTargetKind(this.declarationNode);
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
