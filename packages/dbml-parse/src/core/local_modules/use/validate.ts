import type Compiler from '@/compiler';
import {
  ImportKind,
} from '@/core/types';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  ProgramNode, UseDeclarationNode, UseSpecifierNode, WildcardNode,
} from '@/core/types/nodes';

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
      return [
        new CompileError(CompileErrorCode.INVALID_USE_CONTEXT, '\'use\' must appear at the top level', this.declarationNode),
      ];
    }
    return [];
  }

  private validateBody (): CompileError[] {
    const errors: CompileError[] = [];

    if (this.declarationNode.importPath && !Filepath.isRelative(this.declarationNode.importPath.value)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'Import path must be a relative path (starting with \'./\' or \'../\')', this.declarationNode.importPath));
    }

    if (this.declarationNode.specifiers instanceof WildcardNode) {
      return [];
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
    } else if (!specifier.isKind(...Object.values(ImportKind))) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_KIND, `'${specifier.importKind.value}' is not a valid specifier type`, specifier.importKind));
    }

    return [
      ...errors,
      ...this.compiler.nodeFullname(specifier).getErrors(),
      ...this.compiler.nodeAlias(specifier).getErrors(),
    ];
  }
}
