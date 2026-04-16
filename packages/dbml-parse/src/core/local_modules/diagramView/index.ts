import type Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import {
  ElementDeclarationNode, SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  destructureComplexVariable, isElementNode,
} from '@/core/utils/expression';
import type {
  LocalModule,
} from '../types';
import DiagramViewValidator from './validate';

export const diagramViewModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.DiagramView)) return Report.create(PASS_THROUGH);
    const decl = node as ElementDeclarationNode & { type: SyntaxToken };
    const {
      errors, warnings,
    } = new DiagramViewValidator(compiler, decl).validate();
    return Report.create(undefined, errors, warnings);
  },

  nodeFullname (_compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.DiagramView)) return Report.create(PASS_THROUGH);
    const decl = node as ElementDeclarationNode;
    if (!decl.name) {
      return new Report(undefined, [
        new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'A DiagramView must have a name', decl),
      ]);
    }
    const fragments = destructureComplexVariable(decl.name);
    if (!fragments) return new Report(undefined);
    return new Report(fragments);
  },

  nodeAlias (_compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.DiagramView)) return Report.create(PASS_THROUGH);
    return new Report(undefined);
  },
};
