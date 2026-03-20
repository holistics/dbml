import { ElementDeclarationNode } from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import { NodeToSymbolMap } from '@/core/types';
import { CompileError } from '@/core/errors';

export interface ElementValidatorArgs {
  declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  publicSymbolTable: SymbolTable;
  nodeToSymbol: NodeToSymbolMap;
}

export interface ElementValidatorResult {
  errors: CompileError[];
}

export interface ElementValidator {
  validate(): ElementValidatorResult;
}
