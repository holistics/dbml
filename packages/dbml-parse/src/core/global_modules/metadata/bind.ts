import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
} from '@/core/types/nodes';
import { destructureComplexVariable } from '@/core/utils/expression';
import { getMetadataTargetKind } from '@/core/local_modules/metadata/utils';
import { MetadataTargetKind } from '@/core/types/symbol';
import { resolveMetadataTarget, resolveRefMetadataCandidates } from './utils';

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

    // Refs are not imported, so two visible files may each define a ref with the same name
    if (targetKind === MetadataTargetKind.Ref && resolveRefMetadataCandidates(this.compiler, this.declarationNode).length > 1) {
      return [
        new CompileError(
          CompileErrorCode.BINDING_ERROR,
          `Ref '${nameParts.join('.')}' is ambiguous: it has multiple definitions`,
          nameNode ?? this.declarationNode,
        ),
      ];
    }

    const target = resolveMetadataTarget(this.compiler, this.declarationNode);

    if (!target) {
      return [
        new CompileError(
          CompileErrorCode.BINDING_ERROR,
          `Cannot find metadata target element: \`${this.declarationNode.targetKind?.value} ${nameParts.join('.')}\``,
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
