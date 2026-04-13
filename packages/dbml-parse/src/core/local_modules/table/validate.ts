import {
  last, forIn, partition,
} from 'lodash-es';
import Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ArrayNode,
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  WildcardNode,
} from '@/core/types/nodes';
import {
  extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  aggregateSettingList,
  isUnaryRelationship,
  isValidAlias,
  isValidColor,
  isValidColumnType,
  isValidDefaultValue,
  isValidName,
  isValidPartialInjection,

  Settings,
} from '@/core/utils/validate';
import {
  isExpressionAQuotedString,
  isExpressionAVariableNode,
  isExpressionAnIdentifierNode,
} from '@/core/utils/expression';
import {
  SettingName,
} from '@/core/types/keywords';
import Report from '@/core/types/report';

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
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_TABLE_CONTEXT, 'Table must appear top-level', this.declarationNode)];
    }
    return [];
  }

  validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'A Table must have a name', this.declarationNode)];
    }
    if (nameNode instanceof ArrayNode) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'Invalid array as Table name, maybe you forget to add a space between the name and the setting list?', nameNode)];
    }
    if (nameNode instanceof WildcardNode) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a Table name', nameNode)];
    }
    if (!isValidName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'A Table name must be of the form <table> or <schema>.<table>', nameNode)];
    }

    return [];
  }

  validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (!aliasNode) {
      return [];
    }

    if (!isValidAlias(aliasNode)) {
      return [new CompileError(CompileErrorCode.INVALID_ALIAS, 'Table aliases can only contains alphanumeric and underscore unless surrounded by double quotes', aliasNode)];
    }

    return [];
  }

  validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.HeaderColor:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'headercolor\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isValidColor(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, '\'headercolor\' must be a color literal', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'note\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, '\'note\' must be a string literal', attr.value || attr.name!));
            }
          });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.UNKNOWN_TABLE_SETTING, `Unknown '${name}' setting`, attr)));
      }
    });
    return errors;
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Table\'s body must be a block', body)];
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.validateFields(fields as FunctionApplicationNode[]), ...this.validateSubElements(subs as ElementDeclarationNode[])];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
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

      const remains = field.args.slice(1);
      errors.push(...this.validateFieldSetting(remains));

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
          ...field.args.map((arg) => new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_INJECTION, 'A partial injection does not have any trailing attributes', arg)),
        );
      }
      return errors;
    };
    const fieldErrors = fields.flatMap((field) => {
      if (field.callee instanceof PrefixExpressionNode && field.callee.op?.value === '~') return validatePartialInjection(field);
      return validateColumn(field);
    });

    // Detect duplicate partial injections
    const partialInjections = fields.filter((f) => f.callee instanceof PrefixExpressionNode && f.callee.op?.value === '~' && isValidPartialInjection(f.callee));
    const seenPartials = new Map<string, FunctionApplicationNode>();
    for (const injection of partialInjections) {
      const name = extractVariableFromExpression((injection.callee as PrefixExpressionNode).expression);
      if (!name) continue;
      const existing = seenPartials.get(name);
      if (existing) {
        fieldErrors.push(new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_INJECTION_NAME, `Duplicate table partial injection '${name}'`, existing.callee!));
        fieldErrors.push(new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_INJECTION_NAME, `Duplicate table partial injection '${name}'`, injection.callee!));
      } else {
        seenPartials.set(name, injection);
      }
    }

    return fieldErrors;
  }

  // This is needed to support legacy inline settings
  validateFieldSetting (parts: ExpressionNode[]): CompileError[] {
    if (!parts.slice(0, -1).every(isExpressionAnIdentifierNode) || !parts.slice(-1).every((p) => isExpressionAnIdentifierNode(p) || p instanceof ListExpressionNode)) {
      return parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part));
    }

    if (parts.length === 0) {
      return [];
    }

    let settingList: ListExpressionNode | undefined;
    if (last(parts) instanceof ListExpressionNode) {
      settingList = parts.pop() as ListExpressionNode;
    }

    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    parts.forEach((part) => {
      const name = (extractVariableFromExpression(part) ?? '').toLowerCase();
      if (name !== 'pk' && name !== 'unique') {
        errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part));
        return;
      }
      if (settingMap[name] === undefined) {
        settingMap[name] = [part as PrimaryExpressionNode];
      } else {
        settingMap[name]!.push(part as PrimaryExpressionNode);
      }
    });

    const pkAttrs = settingMap[SettingName.PK] || [];
    const pkeyAttrs = settingMap[SettingName.PrimaryKey] || [];
    if (pkAttrs.length >= 1 && pkeyAttrs.length >= 1) {
      errors.push(
        ...[...pkAttrs, ...pkeyAttrs]
          .map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'Either one of \'primary key\' and \'pk\' can appear', attr)),
      );
    }

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'note can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'note\' must be a quoted string', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Ref:
          attrs.forEach((attr) => {
            if (!isUnaryRelationship(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'ref\' must be a valid unary relationship', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.PrimaryKey:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'primary key can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (attr.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'primary key\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.PK:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'pk\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && attr.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'pk\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.NotNull: {
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'not null\' can only appear once', attr)));
          }
          const nullAttrs = settingMap[SettingName.Null] || [];
          if (attrs.length >= 1 && nullAttrs.length >= 1) {
            errors.push(
              ...[...attrs, ...nullAttrs]
                .map((attr) => new CompileError(CompileErrorCode.CONFLICTING_SETTING, '\'not null\' and \'null\' can not be set at the same time', attr)),
            );
          }
          attrs.forEach((attr) => {
            if (attr.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'not null\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        }
        case SettingName.Null:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'null\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (attr.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'null\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Unique:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'unique\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && attr.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'unique\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Increment:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'increment\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && attr.value !== undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'increment\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Default:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'default\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isValidDefaultValue(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
                '\'default\' must be an enum value, a string literal, number literal, function expression, true, false or null',
                attr.value || attr.name!,
              ));
            }
          });
          break;
        case SettingName.Check:
          attrs.forEach((attr) => {
            if (!(attr.value instanceof FunctionExpressionNode)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'check\' must be a function expression', attr.value || attr.name!));
            }
          });
          break;

        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_COLUMN_SETTING, `Unknown column setting '${name}'`, attr)));
      }
    });
    return errors;
  }

  validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    const errors = subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      return this.compiler.validateNode(sub).getErrors();
    });

    const notes = subs.filter((sub) => sub.type?.value.toLowerCase() === 'note');
    if (notes.length > 1) {
      errors.push(...notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note)));
    }

    return errors;
  }
}

export function validateTableSettings (settingList?: ListExpressionNode): Report<Settings> {
  const aggReport = aggregateSettingList(settingList);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();

  forIn(settingMap, (attrs, name) => {
    switch (name) {
      case SettingName.HeaderColor:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'headercolor\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (!isValidColor(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, '\'headercolor\' must be a color literal', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.Note:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'note\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (!isExpressionAQuotedString(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, '\'note\' must be a string literal', attr.value || attr.name!));
          }
        });
        break;
      default:
        errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.UNKNOWN_TABLE_SETTING, `Unknown '${name}' setting`, attr)));
    }
  });
  return new Report(settingMap, errors);
}

export function validateFieldSetting (parts: ExpressionNode[]): Report<Settings> {
  if (!parts.slice(0, -1).every(isExpressionAnIdentifierNode) || !parts.slice(-1).every((p) => isExpressionAnIdentifierNode(p) || p instanceof ListExpressionNode)) {
    return new Report({}, parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part)));
  }

  if (parts.length === 0) {
    return new Report({});
  }

  let settingList: ListExpressionNode | undefined;
  if (last(parts) instanceof ListExpressionNode) {
    settingList = parts.pop() as ListExpressionNode;
  }

  const aggReport = aggregateSettingList(settingList);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();

  parts.forEach((part) => {
    const name = (extractVariableFromExpression(part) ?? '').toLowerCase();
    if (name !== 'pk' && name !== 'unique') {
      errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part));
      return;
    }
    if (settingMap[name] === undefined) {
      settingMap[name] = [part as PrimaryExpressionNode];
    } else {
      settingMap[name]!.push(part as PrimaryExpressionNode);
    }
  });

  const pkAttrs = settingMap[SettingName.PK] || [];
  const pkeyAttrs = settingMap[SettingName.PrimaryKey] || [];
  if (pkAttrs.length >= 1 && pkeyAttrs.length >= 1) {
    errors.push(
      ...[...pkAttrs, ...pkeyAttrs]
        .map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'Either one of \'primary key\' and \'pk\' can appear', attr)),
    );
  }

  forIn(settingMap, (attrs, name) => {
    switch (name) {
      case SettingName.Note:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'note can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (!isExpressionAQuotedString(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'note\' must be a quoted string', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.Ref:
        attrs.forEach((attr) => {
          if (!isUnaryRelationship(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'ref\' must be a valid unary relationship', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.PrimaryKey:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'primary key can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'primary key\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.PK:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'pk\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr instanceof AttributeNode && attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'pk\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.NotNull: {
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'not null\' can only appear once', attr)));
        }
        const nullAttrs = settingMap[SettingName.Null] || [];
        if (attrs.length >= 1 && nullAttrs.length >= 1) {
          errors.push(
            ...[...attrs, ...nullAttrs]
              .map((attr) => new CompileError(CompileErrorCode.CONFLICTING_SETTING, '\'not null\' and \'null\' can not be set at the same time', attr)),
          );
        }
        attrs.forEach((attr) => {
          if (attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'not null\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      }
      case SettingName.Null:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'null\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'null\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.Unique:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'unique\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr instanceof AttributeNode && attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'unique\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.Increment:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'increment\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr instanceof AttributeNode && attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'increment\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.Default:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'default\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (!isValidDefaultValue(attr.value)) {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
              '\'default\' must be an enum value, a string literal, number literal, function expression, true, false or null',
              attr.value || attr.name!,
            ));
          }
        });
        break;
      case SettingName.Check:
        attrs.forEach((attr) => {
          if (!(attr.value instanceof FunctionExpressionNode)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'check\' must be a function expression', attr.value || attr.name!));
          }
        });
        break;

      default:
        attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_COLUMN_SETTING, `Unknown column setting '${name}'`, attr)));
    }
  });
  return new Report(settingMap, errors);
}
