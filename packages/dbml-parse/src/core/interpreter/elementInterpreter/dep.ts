import { destructureComplexVariable, extractVariableFromExpression } from '@/core/analyzer/utils';
import { aggregateSettingList } from '@/core/analyzer/validator/utils';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, IdentiferStreamNode, InfixExpressionNode, ListExpressionNode, SyntaxNode,
} from '@/core/parser/nodes';
import {
  ElementInterpreter, InterpreterDatabase, Dep, Table,
} from '@/core/interpreter/types';
import {
  extractColor, extractNamesFromRefOperand, getTokenPosition,
} from '@/core/interpreter/utils';
import { extractStringFromIdentifierStream, isExpressionAQuotedString } from '@/core/parser/utils';

function depEndpointKey (e: { schemaName: string | null; tableName: string; fieldNames: string[] }): string {
  return [e.schemaName, e.tableName, ...e.fieldNames].filter(Boolean).join('.');
}

function getDepIdFromOperands (
  leftExpression: SyntaxNode,
  rightExpression: SyntaxNode,
  container: Partial<Table> | undefined,
): string {
  const left = extractNamesFromRefOperand(leftExpression, container as Table | undefined);
  const right = extractNamesFromRefOperand(rightExpression, container as Table | undefined);
  return `${depEndpointKey(left)}->${depEndpointKey(right)}`;
}

export class DepInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private container: Partial<Table> | undefined;
  private depName: string | null = null;
  private depSchemaName: string | null = null;

  constructor (declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.container = this.declarationNode.parent instanceof ElementDeclarationNode ? this.env.tables.get(this.declarationNode.parent) : undefined;
  }

  interpret (): CompileError[] {
    const errors = [
      ...this.interpretName(this.declarationNode.name),
      ...this.interpretBody(this.declarationNode.body!),
    ];
    return errors;
  }

  private interpretName (nameNode?: SyntaxNode): CompileError[] {
    const errors: CompileError[] = [];

    if (!nameNode) {
      this.depName = null;
      this.depSchemaName = null;
      return errors;
    }

    const fragments = destructureComplexVariable(nameNode).unwrap_or([]);
    this.depName = fragments.pop() || null;
    if (fragments.length > 1) {
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', nameNode));
    }
    this.depSchemaName = fragments.join('.') || null;

    return errors;
  }

  private interpretBody (body: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (body instanceof FunctionApplicationNode) {
      return this.interpretField(body);
    }

    return body.body.flatMap((node) => (
      node instanceof FunctionApplicationNode ? this.interpretField(node) : []
    ));
  }

  private interpretField (field: FunctionApplicationNode): CompileError[] {
    const { leftExpression, rightExpression } = field.callee as InfixExpressionNode;

    const leftEp = extractNamesFromRefOperand(leftExpression!, this.container as Table | undefined);
    const rightEp = extractNamesFromRefOperand(rightExpression!, this.container as Table | undefined);

    if (depEndpointKey(leftEp) === depEndpointKey(rightEp)) {
      return [new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', field)];
    }

    const depId = getDepIdFromOperands(leftExpression!, rightExpression!, this.container);
    if (this.env.depIds[depId]) {
      return [
        new CompileError(CompileErrorCode.CIRCULAR_REF, 'Dependencies with same endpoints exist', this.declarationNode),
        new CompileError(CompileErrorCode.CIRCULAR_REF, 'Dependencies with same endpoints exist', this.env.depIds[depId]!),
      ];
    }

    const lineDep: Partial<Dep> = {
      name: this.depName,
      schemaName: this.depSchemaName,
      token: getTokenPosition(field),
    };

    if (field.args[0]) {
      const settingMap = aggregateSettingList(field.args[0] as ListExpressionNode).getValue();

      lineDep.color = settingMap.color?.length ? extractColor(settingMap.color?.at(0)?.value as any) : undefined;

      const noteSetting = settingMap.note?.at(0)?.value;
      if (noteSetting) {
        if (isExpressionAQuotedString(noteSetting)) {
          const noteValue = noteSetting.expression instanceof IdentiferStreamNode
            ? extractStringFromIdentifierStream(noteSetting.expression).unwrap_or('')
            : extractVariableFromExpression(noteSetting).unwrap_or('');
          lineDep.note = {
            value: noteValue as string,
            token: getTokenPosition(noteSetting),
          };
        }
      }
    }

    lineDep.endpoints = [
      {
        ...extractNamesFromRefOperand(leftExpression!, this.container as Table | undefined),
        token: getTokenPosition(leftExpression!),
      },
      {
        ...extractNamesFromRefOperand(rightExpression!, this.container as Table | undefined),
        token: getTokenPosition(rightExpression!),
      },
    ];

    this.env.dep.set(field, lineDep as Dep);
    this.env.depIds[depId] = field;

    return [];
  }
}
