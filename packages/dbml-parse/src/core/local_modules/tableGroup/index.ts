import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { ListExpressionNode, SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { destructureComplexVariable } from '@/core/utils/expression';
import {
  Settings, aggregateSettingList, isElementFieldNode, isElementNode, isSimpleName,
} from '@/core/utils/validate';
import { type LocalModule } from '../types';
import TableGroupValidator from './validate';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { validateCustomInlineMetadata } from '../metadata/utils';
import { TABLEGROUP_METADATA_FIELDS } from '@/core/global_modules/metadata/registries';

export const tableGroupModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      return Report.create(undefined, new TableGroupValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      if (!node.name) {
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.NAME_NOT_FOUND,
            'A TableGroup must have a name',
            node,
          ),
        ]);
      }
      if (!isSimpleName(node.name)) {
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.INVALID_NAME,
            'A TableGroup name must be a single identifier',
            node.name,
          ),
        ]);
      }
      return new Report(destructureComplexVariable(node.name));
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      const names = destructureComplexVariable(node.callee);
      if (names?.length === 1) names.unshift(DEFAULT_SCHEMA_NAME);

      return new Report(names);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      if (node.alias) {
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.UNEXPECTED_ALIAS,
            'A TableGroup shouldn\'t have an alias',
            node.alias,
          ),
        ]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      return validateTableGroupSettings(node.attributeList);
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report({});
    }
    return Report.create(PASS_THROUGH);
  },
};

function validateTableGroupSettings (settingList?: ListExpressionNode): Report<Settings> {
  const aggReport = aggregateSettingList(settingList);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();

  for (const [name, attributes] of Object.entries(settingMap)) {
    switch (name) {
      case SettingName.Note:
      case SettingName.Color: {
        const field = TABLEGROUP_METADATA_FIELDS[name];
        if (attributes.length > 1) {
          errors.push(...attributes.map((attribute) => new CompileError(CompileErrorCode.DUPLICATE_TABLEGROUP_SETTING, `'${name}' can only appear once`, attribute)));
        }

        attributes.forEach((attribute) => {
          if (field.parse(attribute.value) === undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_TABLEGROUP_SETTING_VALUE, field.message, attribute.value || attribute.name || attribute));
          }
        });
        break; }
      default:
        // Any non-builtin key is free-form inline custom metadata
        errors.push(
          ...validateCustomInlineMetadata(name, attributes, {
            duplicate: CompileErrorCode.DUPLICATE_TABLEGROUP_SETTING,
            invalidValue: CompileErrorCode.INVALID_TABLEGROUP_SETTING_VALUE,
          }),
        );
    }
  }
  return new Report(settingMap, errors);
}
