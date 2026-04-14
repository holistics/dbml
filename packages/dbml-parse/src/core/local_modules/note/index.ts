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
  ElementDeclarationNode, ProgramNode, SyntaxNode, WildcardNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  isElementNode,
} from '@/core/utils/expression';
import {
  destructureComplexVariable,
} from '@/core/utils/expression';
import {
  type LocalModule, type Settings,
} from '../types';
import NoteValidator from './validate';

export const noteModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    return Report.create(undefined, new NoteValidator(compiler, node).validate());
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);

    const parent = node.parent;
    if (!(parent instanceof ProgramNode)) {
      if (node.name) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Note shouldn\'t have a name', node.name),
        ]);
      }
      return new Report(undefined);
    }

    if (!node.name) {
      return new Report(undefined, [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Sticky note must have a name', node),
      ]);
    }

    if (node.name instanceof WildcardNode) {
      return new Report(undefined, [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a Note name', node.name),
      ]);
    }
    const nameFragments = destructureComplexVariable(node.name);
    if (nameFragments === undefined) return new Report(undefined, [
      new CompileError(CompileErrorCode.INVALID_NAME, 'Invalid name for sticky note ', node),
    ]);

    return new Report(nameFragments);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    if (node.alias) {
      return new Report(undefined, [
        new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Ref shouldn\'t have an alias', node.alias),
      ]);
    }
    return new Report(undefined);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    if (node.attributeList) {
      return new Report({}, [
        new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Note shouldn\'t have a setting list', node.attributeList),
      ]);
    }
    return new Report({});
  },
};
