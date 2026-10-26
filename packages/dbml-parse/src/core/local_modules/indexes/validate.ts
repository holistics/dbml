import { last, partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import {
  ArrayNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ListExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '@/core/types/nodes';
import { getIndexColumnSortOrder } from '@/core/utils/validate';
import { destructureIndexNode } from '@/core/utils/expression';
import { UNHANDLED } from '@/core/types';

export default class IndexesValidator {
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
    const invalidContextError = new CompileError(
      CompileErrorCode.INVALID_INDEXES_CONTEXT,
      'An Indexes can only appear inside a Table or a TablePartial',
      this.declarationNode,
    );
    if (this.declarationNode.parent instanceof ProgramNode)
      return [invalidContextError];

    return this.declarationNode.parent?.isKind(
      ElementKind.Table,
      ElementKind.TablePartial,
    )
      ? []
      : [invalidContextError];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [
        new CompileError(
          CompileErrorCode.UNEXPECTED_NAME,
          "An Indexes shouldn't have a name",
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
          "An Indexes shouldn't have an alias",
          aliasNode,
        ),
      ];
    }

    return [];
  }

  private validateSettingList (
    settingList?: ListExpressionNode,
  ): CompileError[] {
    if (settingList) {
      return [
        new CompileError(
          CompileErrorCode.UNEXPECTED_SETTINGS,
          "An Indexes shouldn't have a setting list",
          settingList,
        ),
      ];
    }

    return [];
  }

  private validateBody (
    body?: FunctionApplicationNode | BlockExpressionNode,
  ): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [
        new CompileError(
          CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
          'An Indexes must have a complex body',
          body,
        ),
      ];
    }

    const [fields, subs] = partition(
      body.body,
      (e) => e instanceof FunctionApplicationNode,
    );
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      const errors: CompileError[] = [];
      const args = [field.callee, ...field.args];
      const settingsReport = this.compiler.nodeSettings(field);
      errors.push(...settingsReport.getErrors());
      const isPk = !!settingsReport.getFiltered(UNHANDLED)?.[SettingName.PK];
      if (last(args) instanceof ListExpressionNode) {
        args.pop();
      }

      const names: ReturnType<typeof destructureIndexNode>[] = [];
      args.forEach((sub) => {
        // This is to deal with inline indexes field such as
        // (id, name) (age, weight)
        // which is parsed as a call expression
        while (sub instanceof CallExpressionNode) {
          if (sub.argumentList) {
            const fragment = destructureIndexNode(sub.argumentList);
            names.push(fragment);
            if (fragment === undefined) {
              errors.push(createInvalidIndexFieldError(sub.argumentList));
            }
          }
          sub = sub.callee!;
        }

        const fragment = destructureIndexNode(sub);
        names.push(fragment);
        if (fragment === undefined) {
          errors.push(createInvalidIndexFieldError(sub));
        }
      });

      // PostgreSQL and Oracle take no sort order in a PRIMARY KEY constraint
      if (isPk) {
        names
          .flatMap((fragment) => [
            ...(fragment?.functional ?? []),
            ...(fragment?.nonFunctional ?? []),
          ])
          .filter(({ descending }) => descending)
          .forEach(({ name }) =>
            errors.push(
              new CompileError(
                CompileErrorCode.INVALID_INDEXES_FIELD,
                'A primary key index field cannot be descending',
                name,
              ),
            ),
          );
      }

      return errors;
    });
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

export function isValidIndexesType (value?: SyntaxNode): boolean {
  if (
    !(value instanceof PrimaryExpressionNode)
    || !(value.expression instanceof VariableNode)
  ) {
    return false;
  }

  const str = value.expression.variable?.value;

  return str === 'btree' || str === 'hash';
}

// The error for an index field that `destructureIndexNode` cannot read
function createInvalidIndexFieldError (node: SyntaxNode): CompileError {
  const elements =
    node instanceof TupleExpressionNode ? node.elementList : [node];
  const hasBadSetting = elements.some(
    (e) => e instanceof ArrayNode && !getIndexColumnSortOrder(e),
  );
  const message = hasBadSetting
    ? 'An index column setting must be [asc] or [desc]'
    : 'An index field must be an identifier, a quoted identifier, a functional expression or a tuple of such';
  return new CompileError(
    CompileErrorCode.INVALID_INDEXES_FIELD,
    message,
    node,
  );
}
