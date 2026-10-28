import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind } from '@/core/types/keywords';
import {
  ArrayNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  PrefixExpressionNode,
  SyntaxNode,
  WildcardNode,
} from '@/core/types/nodes';
import {
  isExpressionAVariableNode,
  isValidAlias,
  isValidColumnType,
  isValidName,
  isValidPartialInjection,
} from '@/core/utils/validate';

export default class TableValidator {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;

  constructor (
    compiler: Compiler,
    declarationNode: ElementDeclarationNode,
  ) {
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
        new CompileError(CompileErrorCode.INVALID_TABLE_CONTEXT, 'Table must appear top-level', this.declarationNode),
      ];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [
        new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'A Table must have a name', this.declarationNode),
      ];
    }
    if (nameNode instanceof ArrayNode) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Invalid array as Table name, maybe you forget to add a space between the name and the setting list?', nameNode),
      ];
    }
    if (nameNode instanceof WildcardNode) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a Table name', nameNode),
      ];
    }
    if (!isValidName(nameNode)) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'A Table name must be of the form <table> or <schema>.<table>', nameNode),
      ];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (!aliasNode) {
      return [];
    }

    if (!isValidAlias(aliasNode)) {
      return [
        new CompileError(CompileErrorCode.INVALID_ALIAS, 'Table aliases can only contain alphanumeric and underscore unless surrounded by double quotes', aliasNode),
      ];
    }

    return [];
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Table\'s body must be a block', body),
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

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    const validateColumn = (field: FunctionApplicationNode) => {
      const errors: CompileError[] = [];
      if (!field.callee) {
        return [];
      }
      if (field.args.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN, 'A column must have a type', field.callee!));
      }

      if (!isExpressionAVariableNode(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A column name must be an identifier or a quoted identifier', field.callee));
      }

      if (field.args[0] && !isValidColumnType(field.args[0])) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_TYPE, 'Invalid column type', field.args[0]));
      }

      errors.push(...this.compiler.nodeSettings(field).getErrors());

      return errors;
    };
    const validatePartialInjection = (field: FunctionApplicationNode) => {
      const errors: CompileError[] = [];
      if (!field.callee) {
        return [];
      }
      if (!isValidPartialInjection(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_INJECTION, 'A partial injection should be of the form ~<table-partial>', field.callee));
      }
      if (field.args.length) {
        errors.push(
          ...field.args.map((argument) => new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_INJECTION, 'A partial injection does not have any trailing attributes', argument)),
        );
      }
      return errors;
    };
    const fieldErrors = fields.flatMap((field) => {
      if (field.callee instanceof PrefixExpressionNode && field.callee.op?.value === '~') return validatePartialInjection(field);
      return validateColumn(field);
    });

    return fieldErrors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    const errors = subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      return this.compiler.validateNode(sub).getErrors();
    });

    const notes = subs.filter((sub) => sub.isKind(ElementKind.Note));
    if (notes.length > 1) {
      errors.push(...notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note)));
    }

    return errors;
  }
}
