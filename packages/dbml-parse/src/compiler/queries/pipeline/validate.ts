import Validator from '@/core/local_modules/program/validate';
import {
  pickValidator,
} from '@/core/local_modules/utils';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  UNHANDLED, type Unhandled,
} from '@/core/types/module';
import {
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import type Compiler from '../../index';

export function validateFile (this: Compiler, filepath: Filepath): Report<ProgramNode> {
  return this.parseFile(filepath).chain(({
    ast,
  }) =>
    new Validator(ast, this.symbolFactory).validate(),
  );
}

export function validateNode (this: Compiler, node: SyntaxNode): Report<void> | Report<Unhandled> {
  if (node instanceof ProgramNode) {
    return new Validator(node, this.symbolFactory).validate().map(() => undefined);
  }

  if (!(node instanceof ElementDeclarationNode) || !node.type) {
    return Report.create(UNHANDLED);
  }

  const program = node.parentNode;
  if (!(program instanceof ProgramNode) || !program.symbol?.symbolTable) {
    return Report.create(UNHANDLED);
  }

  const Val = pickValidator(node as ElementDeclarationNode & { type: SyntaxToken });
  const validator = new Val(
    node as ElementDeclarationNode & { type: SyntaxToken },
    program.symbol.symbolTable,
    this.symbolFactory,
  );
  const result = validator.validate();

  return Report.create(undefined, result.errors, result.warnings);
}
