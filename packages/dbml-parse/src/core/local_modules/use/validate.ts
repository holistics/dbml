import { CompileError, CompileErrorCode } from '@/core/errors';
import { ProgramNode, UseDeclarationNode, UseSpecifierNode } from '@/core/parser/nodes';
import { ImportKind } from '@/core/types';
import { Filepath } from '@/core/types/filepath';
import type Compiler from '@/compiler';

export default class UseDeclarationValidator {
  private compiler: Compiler;
  private declarationNode: UseDeclarationNode;

  constructor (
    compiler: Compiler,
    declarationNode: UseDeclarationNode,
  ) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateBody(),
    ];
  }

  private validateContext (): CompileError[] {
    if (!(this.declarationNode.parent instanceof ProgramNode)) {
      return [new CompileError(CompileErrorCode.INVALID_USE_CONTEXT, '\'use\' must appear at the top level', this.declarationNode)];
    }
    return [];
  }

  private validateBody (): CompileError[] {
    const errors: CompileError[] = [];

    if (this.declarationNode.importPath && !Filepath.isRelative(this.declarationNode.importPath.value)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'Import path must be a relative path (starting with \'./\' or \'../\')', this.declarationNode.importPath));
    }

    for (const specifier of this.declarationNode.specifiers?.specifiers || []) {
      errors.push(...this.validateSpecifier(specifier));
    }

    return errors;
  }

  private validateSpecifier (specifier: UseSpecifierNode): CompileError[] {
    const errors: CompileError[] = [];

    if (specifier.importKind === undefined) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_KIND, 'A use specifier must have a type (e.g. table, enum)', specifier));
    } else if (specifier.isKind(...Object.keys(ImportKind).map((k) => k.toLowerCase() as ImportKind))) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_KIND, `'${specifier.importKind.value}' is not a valid specifier type`, specifier.importKind));
    }

    return [
      ...errors,
      ...this.compiler.fullname(specifier).getErrors(),
      ...this.compiler.alias(specifier).getErrors(),
    ];
  }
}
