import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { ProgramNode, SyntaxNode, WildcardNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { aggregateSettingList, isElementNode } from '@/core/utils/validate';
import { destructureComplexVariable } from '@/core/utils/expression';
import { type LocalModule, type Settings } from '../types';
import NoteValidator from './validate';
import { validateCustomInlineMetadata } from '../metadata/utils';
import { NOTE_METADATA_FIELDS } from '@/core/global_modules/metadata/registries';
import { isInlineLinkKey } from '@/core/arch/read';

export const noteModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    return Report.create(undefined, new NoteValidator(compiler, node).validate());
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);

    const parent = node.parent;
    if (!(parent instanceof ProgramNode)) {
      if (node.name) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Note shouldn\'t have a name', node.name),
        ]);
      }
      return new Report(undefined);
    }

    if (!node.name) {
      return new Report(undefined, [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Sticky note must have a name', node),
      ]);
    }

    if (node.name instanceof WildcardNode) {
      return new Report(undefined, [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a Note name', node.name),
      ]);
    }
    const nameFragments = destructureComplexVariable(node.name);
    if (nameFragments === undefined) return new Report(undefined, [
      new CompileError(CompileErrorCode.INVALID_NAME, 'Invalid name for sticky note ', node),
    ]);

    return new Report(nameFragments);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    if (node.alias) {
      return new Report(undefined, [
        new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Note shouldn\'t have an alias', node.alias),
      ]);
    }
    return new Report(undefined);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);

    if (!(node.parent instanceof ProgramNode) && node.attributeList) {
      return new Report({}, [
        new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Note shouldn\'t have a setting list', node.attributeList),
      ]);
    }

    const aggReport = aggregateSettingList(node.attributeList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();
    // An architecture file's note carries inline links; the arch module checks those
    const isArch = compiler.parsedFileKind(node.filepath) === 'arch';

    for (const [name, attrs] of Object.entries(settingMap)) {
      if (isArch && isInlineLinkKey(name)) continue;
      switch (name) {
        case SettingName.Color: {
          const field = NOTE_METADATA_FIELDS[SettingName.Color];
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_NOTE_SETTING, `'${name}' can only appear once`, attr)));
          }

          attrs.forEach((attr) => {
            if (field.parse(attr.value) === undefined) {
              errors.push(new CompileError(CompileErrorCode.INVALID_NOTE_SETTING_VALUE, field.message, attr.value || attr.name || attr));
            }
          });
          break; }
        default:
        // Any non-builtin key is free-form inline custom metadata
          errors.push(
            ...validateCustomInlineMetadata(name, attrs, {
              duplicate: CompileErrorCode.DUPLICATE_NOTE_SETTING,
              invalidValue: CompileErrorCode.INVALID_NOTE_SETTING_VALUE,
            }),
          );
      }
    }
    return new Report(settingMap, errors);
  },
};
