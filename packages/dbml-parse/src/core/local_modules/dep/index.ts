import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { ListExpressionNode, SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { destructureComplexVariable } from '@/core/utils/expression';
import {
  aggregateSettingList, isElementFieldNode, isElementNode, isSimpleName,
  type Settings,
} from '@/core/utils/validate';
import { DEP_METADATA_FIELDS } from '@/core/global_modules/metadata/registries';
import { type LocalModule } from '../types';
import { validateCustomInlineMetadata } from '../metadata/utils';
import DepValidator from './validate';

export const depModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Dep)) {
      return Report.create(undefined, new DepValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Dep)) {
      if (!node.name) return new Report(undefined);
      if (!isSimpleName(node.name)) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.INVALID_NAME, 'A Dep\'s name is optional or must be an identifier or a quoted identifier', node.name),
        ]);
      }
      return new Report(destructureComplexVariable(node.name));
    }
    if (isElementFieldNode(node, ElementKind.Dep)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Dep)) {
      if (node.alias) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Dep shouldn\'t have an alias', node.alias),
        ]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.Dep)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Dep) && !isElementFieldNode(node, ElementKind.Dep)) return Report.create(PASS_THROUGH);

    let settingsList: ListExpressionNode | undefined;

    if (isElementNode(node, ElementKind.Dep)) {
      settingsList = node.attributeList;
    } else {
      const lastArg = node.args.at(-1);
      if (lastArg instanceof ListExpressionNode) {
        settingsList = lastArg;
      } else if (node.args[0] instanceof ListExpressionNode) {
        settingsList = node.args[0];
      }
    }

    const aggReport = aggregateSettingList(settingsList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    for (const [name, attrs] of Object.entries(settingMap)) {
      switch (name) {
        case SettingName.Color:
        case SettingName.Note: {
          if (attrs.length > 1) errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_DEP_SETTING, `'${name}' can only appear once`, attr)));
          const field = DEP_METADATA_FIELDS[name];
          attrs.forEach((attr) => {
            if (field.parse(attr.value) === undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_DEP_SETTING_VALUE, field.message, attr));
            }
          });
          break;
        }
        default:
          // Any non-builtin key is free-form inline custom metadata
          errors.push(
            ...validateCustomInlineMetadata(name, attrs, {
              duplicate: CompileErrorCode.DUPLICATE_DEP_SETTING,
              invalidValue: CompileErrorCode.INVALID_DEP_SETTING_VALUE,
            }));
          break;
      }
    }

    return new Report(settingMap, errors);
  },
};
