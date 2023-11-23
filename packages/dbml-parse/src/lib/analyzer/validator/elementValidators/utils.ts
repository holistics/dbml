import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxNode } from '../../../parser/nodes';
import { ElementKind } from '../types';

export function isCustomElement(kind: ElementKind): kind is ElementKind.CUSTOM {
  return kind === ElementKind.CUSTOM;
}

export function getSubfieldKind(kind: ElementKind): string {
  switch (kind) {
    case ElementKind.TABLE:
      return 'column';
    case ElementKind.ENUM:
      return 'field';
    case ElementKind.TABLEGROUP:
      return 'table';
    default:
      return 'subfield';
  }
}

export function transformToReturnCompileErrors(
  validator: (node: SyntaxNode, ith: number) => boolean,
  errorCode: CompileErrorCode,
  errorMessage: string,
): (node: SyntaxNode, ith: number) => CompileError[] {
  return (node: SyntaxNode, ith: number) => {
    if (validator(node, ith)) {
      return [];
    }

    return [new CompileError(errorCode, errorMessage, node)];
  };
}
