import { last } from 'lodash-es';
import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { IdentifierStreamNode, ListExpressionNode, SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { destructureComplexVariable, extractStringFromIdentifierStream } from '@/core/utils/expression';
import {
  Settings, aggregateSettingList, isElementFieldNode, isElementNode, isExpressionAVariableNode, isSimpleName,
} from '@/core/utils/validate';
import { type LocalModule } from '../types';
import RefValidator from './validate';
import { REF_METADATA_FIELDS } from '@/core/global_modules/metadata/registries';
import { validateCustomInlineMetadata } from '../metadata/utils';
import { SyntaxTokenKind } from '@/core/types/tokens';

export const refModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Ref)) {
      return Report.create(undefined, new RefValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Ref)) {
      if (!node.name) return new Report(undefined);
      if (!isSimpleName(node.name)) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.INVALID_NAME, 'A Ref\'s name is optional or must be an identifier or a quoted identifer', node.name),
        ]);
      }
      return new Report(destructureComplexVariable(node.name));
    }
    if (isElementFieldNode(node, ElementKind.Ref)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Ref)) {
      if (node.alias) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Ref shouldn\'t have an alias', node.alias),
        ]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.Ref)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Ref)) {
      if (node.attributeList) {
        return new Report({}, [
          new CompileError(
            CompileErrorCode.UNEXPECTED_SETTINGS,
            'A Ref shouldn\'t have a setting list',
            node.attributeList,
          ),
        ]);
      }
      return new Report({});
    }
    if (isElementFieldNode(node, ElementKind.Ref)) {
      const args = [
        ...node.args,
      ];
      let settingsList: ListExpressionNode | undefined;
      if (last(args) instanceof ListExpressionNode) {
        settingsList = last(args) as ListExpressionNode;
        args.pop();
      } else if (args[0] instanceof ListExpressionNode) {
        settingsList = args[0];
        args.shift();
      }

      const errors = args.map((arg) => new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Ref field should only have a single binary relationship', arg));

      if (!settingsList) return new Report({}, errors);

      const report = validateFieldSettings(settingsList);
      return Report.create(report.getValue(), [...errors, ...report.getErrors()]);
    }
    return Report.create(PASS_THROUGH);
  },
};

export function validateFieldSettings (settings: ListExpressionNode): Report<Settings> {
  const aggReport = aggregateSettingList(settings);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();

  for (const [name, attrs] of Object.entries(settingMap)) {
    switch (name) {
      case SettingName.Delete:
      case SettingName.Update:
        if (attrs.length > 1) {
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_REF_SETTING, `'${name}' can only appear once`, attr)));
        }
        attrs.forEach((attr) => {
          if (!isValidPolicy(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_REF_SETTING_VALUE, `'${name}' can only have values "cascade", "no action", "set null", "set default" or "restrict"`, attr));
          }
        });
        break;
      case SettingName.Color:
      case SettingName.Note: {
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_REF_SETTING, `'${name}' can only appear once`, attr)));
        }
        const field = REF_METADATA_FIELDS[name];
        attrs.forEach((attr) => {
          if (field.parse(attr.value) === undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_REF_SETTING_VALUE, field.message, attr));
          }
        });
        break;
      }
      case SettingName.Inactive:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_REF_SETTING, '\'inactive\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr.value) {
            errors.push(new CompileError(CompileErrorCode.INVALID_REF_SETTING_VALUE, '\'inactive\' cannot have a value', attr));
          }
        });
        break;
      default:
        // Any non-builtin key is free-form inline custom metadata
        errors.push(
          ...validateCustomInlineMetadata(name, attrs, {
            duplicate: CompileErrorCode.DUPLICATE_REF_SETTING,
            invalidValue: CompileErrorCode.INVALID_REF_SETTING_VALUE,
          }));
        break;
    }
  }
  return new Report(settingMap, errors);
}

function isValidPolicy (value?: SyntaxNode): boolean {
  if (
    !(
      isExpressionAVariableNode(value)
      && value.expression.variable.kind !== SyntaxTokenKind.QUOTED_STRING
    )
    && !(value instanceof IdentifierStreamNode)
  ) {
    return false;
  }

  let extractedString: string | undefined;
  if (value instanceof IdentifierStreamNode) {
    extractedString = extractStringFromIdentifierStream(value) || '';
  } else {
    extractedString = value.expression.variable.value;
  }

  if (extractedString) {
    switch (extractedString.toLowerCase()) {
      case 'cascade':
      case 'no action':
      case 'set null':
      case 'set default':
      case 'restrict':
        return true;
      default:
        return false;
    }
  }

  return false; // unreachable
}
