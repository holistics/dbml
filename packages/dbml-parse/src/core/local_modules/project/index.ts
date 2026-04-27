import type Compiler from '@/compiler';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  destructureComplexVariable,
  isElementFieldNode, isElementNode,
} from '@/core/utils/expression';
import {
  type LocalModule, type Settings,
} from '../types';
import ProjectValidator from './validate';
import {
  isSimpleName,
} from '@/core/utils/validate';
import {
  CompileError, CompileErrorCode,
} from '@/core/types';

export const projectModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return Report.create(
        undefined,
        new ProjectValidator(compiler, node).validate(),
      );
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      if (!node.name) {
        return new Report(undefined);
      }

      if (!isSimpleName(node.name)) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.INVALID_NAME, 'A Project\'s name is optional or must be an identifier or a quoted identifer', node.name),
        ]);
      }

      return new Report(destructureComplexVariable(node.name));
    }

    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      if (node.alias) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Project shouldn\'t have an alias', node.alias),
        ]);
      }
    }
    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      if (node.attributeList) {
        return new Report({}, [
          new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Project shouldn\'t have a setting list', node.attributeList),
        ]);
      }

      return new Report({});
    }
    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report({});
    }
    return Report.create(PASS_THROUGH);
  },
};
