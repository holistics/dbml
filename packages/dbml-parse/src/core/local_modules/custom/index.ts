import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementDeclarationNode, SyntaxNode,
} from '@/core/types/nodes';
import type { LocalModule } from '../types';
import {
  PASS_THROUGH, type PassThrough,
} from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler';
import CustomValidator from './validate';
import { Settings } from '@/core/utils/validate';

function isCustomElement (node: SyntaxNode): node is ElementDeclarationNode {
  return node instanceof ElementDeclarationNode && !!node.type?.value;
}

export const customModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isCustomElement(node)) return Report.create(PASS_THROUGH);
    const validator = new CustomValidator(compiler, node);
    return Report.create(undefined, validator.validate());
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isCustomElement(node)) return Report.create(PASS_THROUGH);
    if (node.name) {
      return new Report(undefined, [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A custom field shouldn\'t have a name', node.name)]);
    }
    return new Report(undefined);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isCustomElement(node)) return Report.create(PASS_THROUGH);
    if (node.alias) {
      return new Report(undefined, [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A custom field shouldn\'t have an alias', node.alias)]);
    }
    return new Report(undefined);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isCustomElement(node)) return Report.create(PASS_THROUGH);
    if (node.attributeList) {
      return new Report({}, [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A custom field shouldn\'t have a setting list', node.attributeList)]);
    }
    return new Report({});
  },
};
