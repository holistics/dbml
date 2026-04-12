import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode, WildcardNode,
} from '@/core/types/nodes';
import { ElementKind } from '@/core/types/keywords';
import type { LocalModule } from '../types';
import {
  PASS_THROUGH, type PassThrough,
} from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler';
import { isElementNode } from '@/core/utils/expression';
import { destructureComplexVariable } from '@/core/utils/expression';

export const diagramViewModule: LocalModule = {
  validateNode (_compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.DiagramView)) return Report.create(PASS_THROUGH);
    const errors: CompileError[] = [];
    const decl = node as ElementDeclarationNode;

    if (!decl.name) {
      errors.push(new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'A DiagramView must have a name', decl));
    } else if (decl.name instanceof WildcardNode) {
      errors.push(new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a DiagramView name', decl.name));
    }

    if (decl.alias) {
      errors.push(new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A DiagramView shouldn\'t have an alias', decl.alias));
    }

    if (decl.attributeList) {
      errors.push(new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A DiagramView shouldn\'t have a setting list', decl.attributeList));
    }

    // Validate body: only wildcards and sub-element blocks are allowed at the body level
    if (decl.body instanceof BlockExpressionNode) {
      for (const child of decl.body.body) {
        if (child instanceof ElementDeclarationNode) continue; // sub-block: ok
        if (child instanceof FunctionApplicationNode && child.callee instanceof WildcardNode) continue; // wildcard: ok
        errors.push(new CompileError(CompileErrorCode.INVALID_DIAGRAMVIEW_FIELD, 'Only sub-blocks (Tables, Notes, TableGroups, Schemas) and wildcard (*) are allowed in a DiagramView body', child));
      }
    }

    return Report.create(undefined, errors);
  },

  nodeFullname (_compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.DiagramView)) return Report.create(PASS_THROUGH);
    const decl = node as ElementDeclarationNode;
    if (!decl.name) {
      return new Report(undefined, [new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'A DiagramView must have a name', decl)]);
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
