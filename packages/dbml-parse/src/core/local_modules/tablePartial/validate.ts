import { forIn, last, partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import {
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  WildcardNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import { extractVariableFromExpression } from '@/core/utils/expression';
import { isExpressionAQuotedString, isExpressionAVariableNode, isExpressionAnIdentifierNode } from '@/core/utils/validate';
import {
  Settings,
  aggregateSettingList,
  isSimpleName,
  isUnaryRelationship,
  isValidColumnType,
  isValidDefaultValue,
  isValidHexColor,
} from '@/core/utils/validate';
import { validateCustomInlineMetadata } from '../metadata/utils';

export default class TablePartialValidator {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;

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
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_TABLE_PARTIAL_CONTEXT,
          'TablePartial must appear top-level',
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
          'A TablePartial must have a name',
          this.declarationNode,
        ),
      ];
    }
    if (nameNode instanceof WildcardNode) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a TablePartial name', nameNode),
      ];
    }
    if (!isSimpleName(nameNode)) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'A TablePartial name must be an identifier or a quoted identifer',
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
          'A TablePartial shouldn\'t have an alias',
          aliasNode,
        ),
      ];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attributes, name) => {
      switch (name) {
        case SettingName.HeaderColor:
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (!isValidHexColor(attribute.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_SETTING_VALUE, `'${name}' must be a color literal`, attribute.value || attribute.name!));
            }
          });
          break;
        case SettingName.Note:
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (!isExpressionAQuotedString(attribute.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_SETTING_VALUE, `'${name}' must be a string literal`, attribute.value || attribute.name!));
            }
          });
          break;
        default:
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.UNKNOWN_TABLE_PARTIAL_SETTING, `Unknown '${name}' setting`, attribute)));
      }
    });
    return errors;
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A TablePartial\'s body must be a block', body),
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
    return fields.flatMap((field) => {
      if (!field.callee) return [];

      const errors: CompileError[] = [];
      if (field.args.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN, 'A column must have a type', field.callee!));
      }

      if (!isExpressionAVariableNode(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A column name must be an identifier or a quoted identifier', field.callee));
      }

      if (field.args[0] && !isValidColumnType(field.args[0])) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_TYPE, 'Invalid column type', field.args[0]));
      }

      const remains = field.args.slice(1);
      errors.push(
        ...this.validateFieldSetting(remains),
      );

      return errors;
    });
  }

  // This is needed to support legacy inline settings
  private validateFieldSetting (parts: ExpressionNode[]): CompileError[] {
    const lastPart = last(parts);
    if (
      !parts.slice(0, -1).every(isExpressionAnIdentifierNode)
      || !(isExpressionAnIdentifierNode(lastPart) || lastPart instanceof ListExpressionNode)
    ) {
      return parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part));
    }

    if (parts.length === 0) return [];

    let settingList: ListExpressionNode | undefined;
    if (last(parts) instanceof ListExpressionNode) {
      settingList = parts.pop() as ListExpressionNode;
    }

    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap: {
      [index: string]: AttributeNode[];
    } & {
      pk?: (AttributeNode | PrimaryExpressionNode)[];
      unique?: (AttributeNode | PrimaryExpressionNode)[];
    } = aggReport.getValue();

    parts.forEach((part) => {
      const name = (extractVariableFromExpression(part) ?? '').toLowerCase();
      if (name !== SettingName.PK && name !== SettingName.Unique) {
        errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part));
        return;
      }
      if (settingMap[name] === undefined) {
        settingMap[name] = [
          part as PrimaryExpressionNode,
        ];
      } else {
        settingMap[name]!.push(part as PrimaryExpressionNode);
      }
    });

    const pkAttributes = settingMap[SettingName.PK] || [];
    const pkeyAttributes = settingMap[SettingName.PrimaryKey] || [];
    if (pkAttributes.length >= 1 && pkeyAttributes.length >= 1) {
      errors.push(...[
        ...pkAttributes,
        ...pkeyAttributes,
      ].map((attribute) => new CompileError(
        CompileErrorCode.DUPLICATE_COLUMN_SETTING,
        'Either one of \'primary key\' and \'pk\' can appear',
        attribute,
      )));
    }

    forIn(settingMap, (attributes, name) => {
      switch (name) {
        case SettingName.Note:
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (!isExpressionAQuotedString(attribute.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must be a quoted string`, attribute.value || attribute.name!));
            }
          });
          break;

        case SettingName.Ref:
          attributes.forEach((attribute) => {
            if (!isUnaryRelationship(attribute.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must be a valid unary relationship`, attribute.value || attribute.name!));
            }
          });
          break;

        case SettingName.PrimaryKey:
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (attribute.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
            }
          });
          break;

        case SettingName.PK:
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (attribute instanceof AttributeNode && attribute.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
            }
          });
          break;

        case SettingName.NotNull: {
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
          }
          const nullAttributes = settingMap[SettingName.Null] || [];
          if (attributes.length >= 1 && nullAttributes.length >= 1) {
            errors.push(...[
              ...attributes,
              ...nullAttributes,
            ].map((attribute) => new CompileError(
              CompileErrorCode.CONFLICTING_SETTING,
              '\'not null\' and \'null\' can not be set at the same time',
              attribute,
            )));
          }
          attributes.forEach((attribute) => {
            if (attribute.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
            }
          });
          break;
        }

        case SettingName.Null:
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (attribute.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
            }
          });
          break;

        case SettingName.Unique:
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (attribute instanceof AttributeNode && attribute.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
            }
          });
          break;

        case SettingName.Increment:
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (attribute instanceof AttributeNode && attribute.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
            }
          });
          break;

        case SettingName.Default:
          if (attributes.length > 1) {
            errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (!isValidDefaultValue(attribute.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
                `'${name}' must be a string literal, number literal, function expression, true, false or null`,
                attribute.value || attribute.name!,
              ));
            }
          });
          break;

        case SettingName.Check:
          attributes.forEach((attribute) => {
            if (!(attribute.value instanceof FunctionExpressionNode)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'check\' must be a function expression', attribute.value || attribute.name!));
            }
          });
          break;

        default:
          // Any non-builtin key is free-form inline custom metadata
          errors.push(...validateCustomInlineMetadata(name, attributes, {
            duplicate: CompileErrorCode.DUPLICATE_COLUMN_SETTING,
            invalidValue: CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
          }));
      }
    });
    return errors;
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

export function validateTablePartialSettings (settingList?: ListExpressionNode): Report<Settings> {
  const aggReport = aggregateSettingList(settingList);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();

  forIn(settingMap, (attributes, name) => {
    switch (name) {
      case SettingName.HeaderColor:
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_SETTING, `'${name}' can only appear once`, attribute)));
        }
        attributes.forEach((attribute) => {
          if (!isValidHexColor(attribute.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_SETTING_VALUE, `'${name}' must be a color literal`, attribute.value || attribute.name!));
          }
        });
        break;
      case SettingName.Note:
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_SETTING, `'${name}' can only appear once`, attribute)));
        }
        attributes.forEach((attribute) => {
          if (!isExpressionAQuotedString(attribute.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_SETTING_VALUE, `'${name}' must be a string literal`, attribute.value || attribute.name!));
          }
        });
        break;
      default:
        errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.UNKNOWN_TABLE_PARTIAL_SETTING, `Unknown '${name}' setting`, attribute)));
    }
  });
  return new Report(settingMap, errors);
}

export function validateFieldSetting (parts: ExpressionNode[]): Report<Settings> {
  const lastPart = last(parts);
  if (
    parts.length > 0
    && (!parts.slice(0, -1).every(isExpressionAnIdentifierNode)
      || !(isExpressionAnIdentifierNode(lastPart) || lastPart instanceof ListExpressionNode))
  ) {
    return new Report({},
      parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part)),
    );
  }

  if (parts.length === 0) return new Report({});

  let settingList: ListExpressionNode | undefined;
  if (last(parts) instanceof ListExpressionNode) {
    settingList = parts.pop() as ListExpressionNode;
  }

  const aggReport = aggregateSettingList(settingList);
  const errors = aggReport.getErrors();
  const settingMap: {
    [index: string]: AttributeNode[];
  } & {
    pk?: (AttributeNode | PrimaryExpressionNode)[];
    unique?: (AttributeNode | PrimaryExpressionNode)[];
  } = aggReport.getValue();

  parts.forEach((part) => {
    const name = (extractVariableFromExpression(part) ?? '').toLowerCase();
    if (name !== SettingName.PK && name !== SettingName.Unique) {
      errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part));
      return;
    }
    if (settingMap[name] === undefined) {
      settingMap[name] = [
        part as PrimaryExpressionNode,
      ];
    } else {
      settingMap[name]!.push(part as PrimaryExpressionNode);
    }
  });

  const pkAttributes = settingMap[SettingName.PK] || [];
  const pkeyAttributes = settingMap[SettingName.PrimaryKey] || [];
  if (pkAttributes.length >= 1 && pkeyAttributes.length >= 1) {
    errors.push(...[
      ...pkAttributes,
      ...pkeyAttributes,
    ].map((attribute) => new CompileError(
      CompileErrorCode.DUPLICATE_COLUMN_SETTING,
      'Either one of \'primary key\' and \'pk\' can appear',
      attribute,
    )));
  }

  forIn(settingMap, (attributes, name) => {
    switch (name) {
      case SettingName.Note:
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
        }
        attributes.forEach((attribute) => {
          if (!isExpressionAQuotedString(attribute.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must be a quoted string`, attribute.value || attribute.name!));
          }
        });
        break;

      case SettingName.Ref:
        attributes.forEach((attribute) => {
          if (!isUnaryRelationship(attribute.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must be a valid unary relationship`, attribute.value || attribute.name!));
          }
        });
        break;

      case SettingName.PrimaryKey:
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
        }
        attributes.forEach((attribute) => {
          if (attribute.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
          }
        });
        break;

      case SettingName.PK:
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
        }
        attributes.forEach((attribute) => {
          if (attribute instanceof AttributeNode && attribute.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
          }
        });
        break;

      case SettingName.NotNull: {
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
        }
        const nullAttributes = settingMap[SettingName.Null] || [];
        if (attributes.length >= 1 && nullAttributes.length >= 1) {
          errors.push(...[
            ...attributes,
            ...nullAttributes,
          ].map((attribute) => new CompileError(
            CompileErrorCode.CONFLICTING_SETTING,
            '\'not null\' and \'null\' can not be set at the same time',
            attribute,
          )));
        }
        attributes.forEach((attribute) => {
          if (attribute.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
          }
        });
        break;
      }

      case SettingName.Null:
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
        }
        attributes.forEach((attribute) => {
          if (attribute.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
          }
        });
        break;

      case SettingName.Unique:
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
        }
        attributes.forEach((attribute) => {
          if (attribute instanceof AttributeNode && attribute.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
          }
        });
        break;

      case SettingName.Increment:
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
        }
        attributes.forEach((attribute) => {
          if (attribute instanceof AttributeNode && attribute.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attribute.value || attribute.name!));
          }
        });
        break;

      case SettingName.Default:
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attribute)));
        }
        attributes.forEach((attribute) => {
          if (!isValidDefaultValue(attribute.value)) {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
              `'${name}' must be a string literal, number literal, function expression, true, false or null`,
              attribute.value || attribute.name!,
            ));
          }
        });
        break;

      case SettingName.Check:
        attributes.forEach((attribute) => {
          if (!(attribute.value instanceof FunctionExpressionNode)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'check\' must be a function expression', attribute.value || attribute.name!));
          }
        });
        break;

      default:
        // Any non-builtin key is free-form inline custom metadata
        errors.push(...validateCustomInlineMetadata(name, attributes, {
          duplicate: CompileErrorCode.DUPLICATE_COLUMN_SETTING,
          invalidValue: CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
        }));
    }
  });
  return new Report(settingMap, errors);
}
