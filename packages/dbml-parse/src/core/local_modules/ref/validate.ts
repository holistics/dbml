import { last, partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode,
  ProgramNode, SyntaxNode, WildcardNode,
} from '@/core/types/nodes';
import { destructureComplexVariableTuple } from '@/core/utils/expression';
import { isSimpleName, isBinaryRelationship, isEqualTupleOperands } from '@/core/utils/validate';
import { validateFieldSettings } from './index';

export default class RefValidator {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode) {
      return [];
    }
    return [
      new CompileError(CompileErrorCode.INVALID_REF_CONTEXT, 'A Ref must appear top-level', this.declarationNode),
    ];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [];
    }

    if (nameNode instanceof WildcardNode) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a Ref name', nameNode),
      ];
    }
    if (!isSimpleName(nameNode)) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'A Ref\'s name is optional or must be an identifier or a quoted identifer', nameNode),
      ];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Ref shouldn\'t have an alias', aliasNode),
      ];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Ref shouldn\'t have a setting list', settingList),
      ];
    }

    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.validateFields([
        body,
      ]);
    }

    const [
      fields,
      subs,
    ] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    if (fields.length === 0) {
      return [
        new CompileError(CompileErrorCode.EMPTY_REF, 'A Ref must have at least one field', this.declarationNode),
      ];
    }

    const errors: CompileError[] = [];
    if (fields.length > 1) {
      errors.push(...fields.slice(1).map((field) => new CompileError(CompileErrorCode.REF_REDEFINED, 'A Ref can only contain one binary relationship', field)));
    }

    fields.forEach((field) => {
      if (field.callee && !isBinaryRelationship(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Ref field must be a binary relationship', field.callee));
      }

      if (field.callee && isBinaryRelationship(field.callee)) {
        const leftFragment = destructureComplexVariableTuple(field.callee.leftExpression) ?? {
          variables: [],
          tupleElements: [],
        };
        const leftFragmentCount = leftFragment.variables.length + Math.min(leftFragment.tupleElements.length, 1);
        const rightFragment = destructureComplexVariableTuple(field.callee.rightExpression) ?? {
          variables: [],
          tupleElements: [],
        };
        const rightFragmentCount = rightFragment.variables.length + Math.min(rightFragment.tupleElements.length, 1);
        if (leftFragmentCount < 2) {
          errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'Invalid column reference', field.callee.leftExpression || field.callee));
        }
        if (rightFragmentCount < 2) {
          errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'Invalid column reference', field.callee.rightExpression || field.callee));
        }
      }

      if (field.callee && !isEqualTupleOperands(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.UNEQUAL_FIELDS_BINARY_REF, 'Unequal fields in ref endpoints', field.callee));
      }

      errors.push(...this.compiler.nodeSettings(field).getErrors());

      // const args = [
      //   ...field.args,
      // ];
      // if (last(args) instanceof ListExpressionNode) {
      //   const errs = this.validateFieldSettings(last(args) as ListExpressionNode);
      //   errors.push(...errs);
      //   args.pop();
      // } else if (args[0] instanceof ListExpressionNode) {
      //   errors.push(...this.validateFieldSettings(args[0]));
      //   args.shift();
      // }
      //
      // if (args.length > 0) {
      //   errors.push(...args.map((arg) => new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Ref field should only have a single binary relationship', arg)));
      // }
    });

    return errors;
  }

  // validateFieldSettings (settings: ListExpressionNode): CompileError[] {
  //   return validateFieldSettings(settings).getErrors();
  // }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      return this.compiler.validateNode(sub).getErrors();
    });
  }
}
