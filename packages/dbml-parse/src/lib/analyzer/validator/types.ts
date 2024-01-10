import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode } from '../../parser/nodes';
import { CompileError } from '../../errors';

export interface ElementValidator {
  validate(): CompileError[];
};
