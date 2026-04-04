import { isElementNode } from '@/core/utils/expression';
import { destructureComplexVariable } from '@/core/utils/expression';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  ElementDeclarationNode, ProgramNode, SyntaxNode,
} from '@/core/parser/nodes';
import { ElementKind } from '@/core/types/keywords';
import { type LocalModule, type Settings } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler';
import NoteValidator from './validate';

export const noteModule: LocalModule = {
  validate (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    return Report.create(undefined, new NoteValidator(compiler, node).validate());
  },

  fullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);

    const parent = node.parent;
    if (!(parent instanceof ProgramNode)) {
      if (node.name) {
        return new Report(undefined, [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Note shouldn\'t have a name', node.name)]);
      }
      return new Report(undefined);
    }

    if (!node.name) {
      return new Report(undefined, [new CompileError(CompileErrorCode.INVALID_NAME, 'Sticky note must have a name', node)]);
    }

    const nameFragments = destructureComplexVariable(node.name);
    if (nameFragments === undefined) return new Report(undefined, [new CompileError(CompileErrorCode.INVALID_NAME, 'Invalid name for sticky note ', node)]);

    return new Report(nameFragments);
  },

  alias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    if (node.alias) {
      return new Report(undefined, [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Ref shouldn\'t have an alias', node.alias)]);
    }
    return new Report(undefined);
  },

  settings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    if (node.attributeList) {
      return new Report({}, [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Note shouldn\'t have a setting list', node.attributeList)]);
    }
    return new Report({});
  },
};
