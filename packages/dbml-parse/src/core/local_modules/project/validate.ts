import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '@/core/types/nodes';
import { destructureComplexVariable } from '@/core/utils/expression';
import { isSimpleName, type Settings } from '@/core/utils/validate';
import Report from '@/core/types/report';

export default class ProjectValidator {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name).getErrors(),
      ...this.validateAlias(this.declarationNode.alias).getErrors(),
      ...this.validateSettingList(this.declarationNode.attributeList).getErrors(),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_PROJECT_CONTEXT, 'A Project can only appear top-level', this.declarationNode)];
    }

    return [];
  }

  validateName (nameNode?: SyntaxNode): Report<string[] | undefined> {
    if (!nameNode) {
      return new Report(undefined);
    }

    if (!isSimpleName(nameNode)) {
      return new Report(undefined, [new CompileError(CompileErrorCode.INVALID_NAME, 'A Project\'s name is optional or must be an identifier or a quoted identifer', nameNode)]);
    }

    return new Report(destructureComplexVariable(nameNode));
  }

  validateAlias (aliasNode?: SyntaxNode): Report<string | undefined> {
    if (aliasNode) {
      return new Report(undefined, [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Project shouldn\'t have an alias', aliasNode)]);
    }

    return new Report(undefined);
  }

  validateSettingList (settingList?: ListExpressionNode): Report<Settings> {
    if (settingList) {
      return new Report({}, [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Project shouldn\'t have a setting list', settingList)]);
    }

    return new Report({});
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Project\'s body must be a block', body)];
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...fields.map((field) => new CompileError(CompileErrorCode.INVALID_PROJECT_FIELD, 'A Project can not have inline fields', field)),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      return this.compiler.validate(sub).getErrors();
    });
  }
}
