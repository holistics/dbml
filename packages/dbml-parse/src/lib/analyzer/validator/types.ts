import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode } from '../../parser/nodes';
import { CompileError } from '../../errors';

export interface ElementValidator {
  validate(): CompileError[];

  validateContext(): CompileError[];
  validateName(nameNode?: SyntaxNode): CompileError[];
  validateAlias(aliasNode?: SyntaxNode): CompileError[];
  validateSettingList(settingList?: ListExpressionNode): CompileError[];
  validateBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[];
  // register the element's symbol to the container symbol table
  registerElement?(): CompileError[];
  registerField?(field: FunctionApplicationNode): CompileError[];
};
