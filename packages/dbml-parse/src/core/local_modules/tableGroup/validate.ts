import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind } from '@/core/types/keywords';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode, WildcardNode,
} from '@/core/types/nodes';
import { destructureComplexVariable } from '@/core/utils/expression';
import { isSimpleName } from '@/core/utils/validate';

export default class TableGroupValidator {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.compiler.nodeSettings(this.declarationNode).getErrors(),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_TABLEGROUP_CONTEXT,
          'TableGroup must appear top-level',
          this.declarationNode,
        ),
      ];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [
        new CompileError(
          CompileErrorCode.NAME_NOT_FOUND,
          'A TableGroup must have a name',
          this.declarationNode,
        ),
      ];
    }
    if (nameNode instanceof WildcardNode) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a TableGroup name', nameNode),
      ];
    }
    if (!isSimpleName(nameNode)) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'A TableGroup name must be a single identifier',
          nameNode,
        ),
      ];
    }
    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [
        new CompileError(
          CompileErrorCode.UNEXPECTED_ALIAS,
          'A TableGroup shouldn\'t have an alias',
          aliasNode,
        ),
      ];
    }

    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [
        new CompileError(
          CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
          'A TableGroup\'s body must be a block',
          body,
        ),
      ];
    }

    const [
      fields,
      subs,
    ] = partition(body.body, (element) => element instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      const errors: CompileError[] = [];
      if (field.callee && destructureComplexVariable(field.callee) === undefined) {
        errors.push(new CompileError(CompileErrorCode.INVALID_TABLEGROUP_FIELD, 'A TableGroup field must be of the form <table> or <schema>.<table>', field.callee));
      }

      if (field.args.length > 0) {
        errors.push(...field.args.map((argument) => new CompileError(CompileErrorCode.INVALID_TABLEGROUP_FIELD, 'A TableGroup field should only have a single Table name', argument)));
      }

      return errors;
    });
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    const errors = subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      return this.compiler.validateNode(sub).getErrors();
    });

    const notes = subs.filter((sub) => sub.isKind(ElementKind.Note));
    if (notes.length > 1) errors.push(...notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note)));
    return errors;
  }
}
