import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  isSimpleName, isValidColor, aggregateSettingList, Settings } from '@/core/utils/validate';
import Report from '@/core/report';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '@/core/parser/nodes';
import { destructureComplexVariable, isExpressionAQuotedString } from '@/core/utils/expression';

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
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(
        CompileErrorCode.INVALID_TABLEGROUP_CONTEXT,
        'TableGroup must appear top-level',
        this.declarationNode,
      )];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(
        CompileErrorCode.NAME_NOT_FOUND,
        'A TableGroup must have a name',
        this.declarationNode,
      )];
    }
    if (!isSimpleName(nameNode)) {
      return [new CompileError(
        CompileErrorCode.INVALID_NAME,
        'A TableGroup name must be a single identifier',
        nameNode,
      )];
    }
    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(
        CompileErrorCode.UNEXPECTED_ALIAS,
        'A TableGroup shouldn\'t have an alias',
        aliasNode,
      )];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    for (const [name, attrs] of Object.entries(settingMap)) {
      switch (name) {
        case 'color':
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(
              CompileErrorCode.DUPLICATE_TABLE_SETTING,
              '\'color\' can only appear once',
              attr,
            )));
          }
          attrs.forEach((attr) => {
            if (!isValidColor(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_TABLE_SETTING_VALUE,
                '\'color\' must be a color literal',
                attr.value || attr.name!,
              ));
            }
          });
          break;
        case 'note':
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(
              CompileErrorCode.DUPLICATE_TABLE_SETTING,
              '\'note\' can only appear once',
              attr,
            )));
          }
          attrs
            .filter((attr) => !isExpressionAQuotedString(attr.value))
            .forEach((attr) => {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_TABLE_SETTING_VALUE,
                '\'note\' must be a string literal',
                attr.value || attr.name!,
              ));
            });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(
            CompileErrorCode.UNKNOWN_TABLE_SETTING,
            `Unknown '${name}' setting`,
            attr,
          )));
          break;
      }
    }
    return errors;
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(
        CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
        'A TableGroup\'s body must be a block',
        body,
      )];
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
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
        errors.push(...field.args.map((arg) => new CompileError(CompileErrorCode.INVALID_TABLEGROUP_FIELD, 'A TableGroup field should only have a single Table name', arg)));
      }

      return errors;
    });
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    const errors = subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      return this.compiler.validate(sub).getErrors();
    });

    const notes = subs.filter((sub) => sub.type?.value.toLowerCase() === 'note');
    if (notes.length > 1) errors.push(...notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note)));
    return errors;
  }
}

export function validateSettingList (settingList?: ListExpressionNode): Report<Settings> {
  const aggReport = aggregateSettingList(settingList);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();
  const clean: Settings = {};

  for (const [name, attrs] of Object.entries(settingMap)) {
    switch (name) {
      case 'color':
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(
            CompileErrorCode.DUPLICATE_TABLE_SETTING,
            '\'color\' can only appear once',
            attr,
          )));
        }
        attrs.forEach((attr) => {
          if (!isValidColor(attr.value)) {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_TABLE_SETTING_VALUE,
              '\'color\' must be a color literal',
              attr.value || attr.name!,
            ));
          }
        });
        clean[name] = attrs;
        break;
      case 'note':
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(
            CompileErrorCode.DUPLICATE_TABLE_SETTING,
            '\'note\' can only appear once',
            attr,
          )));
        }
        attrs
          .filter((attr) => !isExpressionAQuotedString(attr.value))
          .forEach((attr) => {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_TABLE_SETTING_VALUE,
              '\'note\' must be a string literal',
              attr.value || attr.name!,
            ));
          });
        clean[name] = attrs;
        break;
      default:
        errors.push(...attrs.map((attr) => new CompileError(
          CompileErrorCode.UNKNOWN_TABLE_SETTING,
          `Unknown '${name}' setting`,
          attr,
        )));
        break;
    }
  }

  return new Report(clean, errors);
}
