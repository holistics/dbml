import { partition, forIn } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '@/core/types/nodes';
import {
  aggregateSettingList, isExpressionAQuotedString, isValidColor, isExpressionAnIdentifierNode,
} from '@/core/utils/validate';
import { NONE_COLOR } from '@/constants';

export default class NoteValidator {
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
    const parent = this.declarationNode.parent;
    if (
      !(parent instanceof ProgramNode)
      && !(parent instanceof ElementDeclarationNode && parent.isKind(
        ElementKind.Table,
        ElementKind.TableGroup,
        ElementKind.TablePartial,
        ElementKind.Project,
      ))
    ) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NOTE_CONTEXT,
          'A Note can only appear inside a Table, a TableGroup, a TablePartial or a Project. Sticky note can only appear at the global scope.',
          this.declarationNode,
        ),
      ];
    }

    return [];
  }

  private validateName (_nameNode?: SyntaxNode): CompileError[] {
    return this.compiler.nodeFullname(this.declarationNode).getErrors();
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Note shouldn\'t have an alias', aliasNode),
      ];
    }

    return [];
  }

  // A sticky note is a Note that appears top-level
  // A sticky note is not if it appear nested
  private isStickyNote (): boolean {
    return this.declarationNode.parent instanceof ProgramNode;
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (!settingList) return [];

    // Normal note (non-sticky) cannot have settings
    if (!this.isStickyNote()) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Note shouldn\'t have a setting list', settingList),
      ];
    }

    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        // Sticky note color
        case SettingName.Color:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_NOTE_SETTING, '\'color\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            // color can be `none` (transparent)
            const isNoneKeyword = isExpressionAnIdentifierNode(attr.value) && attr.value.expression.variable.value.toLowerCase() === NONE_COLOR;
            // color can be a hex number
            if (!isValidColor(attr.value) && !isNoneKeyword) {
              errors.push(new CompileError(CompileErrorCode.INVALID_NOTE_SETTING_VALUE, '\'color\' must be a color literal or \'none\'', attr.value || attr.name!));
            }
          });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.UNKNOWN_NOTE_SETTING, `Unknown '${name}' setting`, attr)));
      }
    });

    return errors;
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
    const errors: CompileError[] = [];
    if (fields.length === 0) {
      return [
        new CompileError(CompileErrorCode.EMPTY_NOTE, 'A Note must have a content', this.declarationNode),
      ];
    }
    if (fields.length > 1) {
      fields.slice(1).forEach((field) => errors.push(new CompileError(CompileErrorCode.NOTE_CONTENT_REDEFINED, 'A Note can only contain one string', field)));
    }
    if (!isExpressionAQuotedString(fields[0].callee)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_NOTE, 'A Note content must be a quoted string', fields[0]));
    }
    if (fields[0].args.length > 0) {
      errors.push(...fields[0].args.map((arg) => new CompileError(CompileErrorCode.INVALID_NOTE, 'A Note can only contain one quoted string', arg)));
    }
    return errors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      return this.compiler.validateNode(sub).getErrors();
    });
  }
}
