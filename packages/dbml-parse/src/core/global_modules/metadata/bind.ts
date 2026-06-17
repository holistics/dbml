import type Compiler from '@/compiler';
import { ALLOWED_METADATA_TARGET_KINDS, CompileError, CompileErrorCode } from '@/core/types';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  type MetadataElementNode,
  SyntaxNode,
} from '@/core/types/nodes';
import { resolveMetadataTarget } from './resolve';
import { destructureComplexVariable } from '@/core/utils/expression';
import { getElementSubKind } from '@/core/utils/validate';
import { SyntaxToken } from '@/core/types/tokens';

export default class MetadataBinder {
  private compiler: Compiler;
  private declarationNode: MetadataElementNode;

  constructor (compiler: Compiler, declarationNode: MetadataElementNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  bind (): CompileError[] {
    const errors: CompileError[] = [];

    // The target kind keyword must be one of the allowed element types.
    const kind = getElementSubKind(this.declarationNode.getElementKind(), this.declarationNode.subKind);
    if (!kind) {
      errors.push(new CompileError(
        CompileErrorCode.INVALID_METADATA_TARGET_KIND,
        `A Metadata target kind must be one of: ${ALLOWED_METADATA_TARGET_KINDS.join(', ')}`,
        this.declarationNode.subKind ?? this.declarationNode,
      ));
      return errors;
    }

    // The target element must exist.
    const target = resolveMetadataTarget(this.compiler, this.declarationNode);
    if (!target) {
      errors.push(new CompileError(
        CompileErrorCode.METADATA_TARGET_NOT_FOUND,
        'Metadata must target an existing element',
        this.declarationNode.name ?? this.declarationNode,
      ));
    }

    errors.push(...this.bindTargetElement(this.declarationNode.subKind, this.declarationNode.name));
    errors.push(...this.bindBody(this.declarationNode.body));
    return errors;
  }

  private bindTargetElement (subKindToken: SyntaxToken | undefined, nameNode?: SyntaxNode): CompileError[] {
    const subKind = getElementSubKind(this.declarationNode.getElementKind(), subKindToken);
    const nameParts = destructureComplexVariable(nameNode);
    if (!nameParts?.length || !subKind) return [];

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
    if (!(body instanceof BlockExpressionNode)) {
      return [];
    }

    const subs = body.body.filter((e) => e instanceof ElementDeclarationNode);
    return (subs as ElementDeclarationNode[]).flatMap((sub) => {
      if (!sub.type) return [];
      return this.compiler.bindNode(sub).getErrors();
    });
  }
}
