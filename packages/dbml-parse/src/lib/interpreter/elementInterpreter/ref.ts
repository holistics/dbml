import _ from "lodash";
import { destructureComplexVariable, extractVariableFromExpression } from "../../analyzer/utils";
import { aggregateSettingList } from "../../analyzer/validator/utils";
import { CompileError, CompileErrorCode } from "../../errors";
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, IdentiferStreamNode, InfixExpressionNode, ListExpressionNode, SyntaxNode } from "../../parser/nodes";
import { ElementInterpreter, InterpreterDatabase, Ref, Table } from "../types";
import { extractNamesFromRefOperand, getColumnSymbolsOfRefOperand, getMultiplicities, getRefId, getTokenPosition, isSameEndpoint } from "../utils";
import { extractStringFromIdentifierStream } from "../../parser/utils";

export class RefInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private container: Partial<Table> | undefined;
  private ref: Partial<Ref>;

  constructor(declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.container = this.declarationNode.parent instanceof ElementDeclarationNode ? this.env.tables.get(this.declarationNode.parent) : undefined;
    this.ref = { };
  }

  interpret(): CompileError[] {
    this.ref.token = getTokenPosition(this.declarationNode);
    this.env.ref.set(this.declarationNode, this.ref as Ref);
    const errors = [...this.interpretName(this.declarationNode.name!), ...this.interpretBody(this.declarationNode.body!)];

    return errors;
  }

  private interpretName(nameNode: SyntaxNode): CompileError[] {
    const errors: CompileError[] = [];

    const fragments = destructureComplexVariable(this.declarationNode.name!).unwrap_or([]);
    this.ref.name = fragments.pop() || null;
    if (fragments.length > 1) {
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', this.declarationNode.name!));
    }
    this.ref.schemaName = fragments.join('.') || null;

    return errors;
  }

  private interpretBody(body: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (body instanceof FunctionApplicationNode) {
      return this.interpretField(body);
    }

    return this.interpretField(body.body[0] as FunctionApplicationNode);
  }

  private interpretField(field: FunctionApplicationNode): CompileError[] {
    const op = (field.callee as InfixExpressionNode).op!.value;
    const { leftExpression, rightExpression } = field.callee as InfixExpressionNode;

    const leftSymbols = getColumnSymbolsOfRefOperand(leftExpression!);
    const rightSymbols = getColumnSymbolsOfRefOperand(rightExpression!);

    if (isSameEndpoint(leftSymbols, rightSymbols)) {
      return [new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', field)];
    }

    const refId = getRefId(leftSymbols, rightSymbols);
    if (this.env.refIds[refId]) {
      return [
        new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', this.declarationNode),
        new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', this.env.refIds[refId]),
      ];
    }

    if (field.args[0]) {
      const settingMap = aggregateSettingList(field.args[0] as ListExpressionNode).getValue();
      const deleteSetting = settingMap['delete']?.at(0)?.value;
      this.ref.onDelete = deleteSetting instanceof IdentiferStreamNode
        ? extractStringFromIdentifierStream(deleteSetting).unwrap_or(undefined) 
        : extractVariableFromExpression(deleteSetting).unwrap_or(undefined) as string;
      const updateSetting = settingMap['update']?.at(0)?.value;
      this.ref.onUpdate = updateSetting instanceof IdentiferStreamNode
        ? extractStringFromIdentifierStream(updateSetting).unwrap_or(undefined)
        : extractVariableFromExpression(updateSetting).unwrap_or(undefined) as string;
    }

    const multiplicities = getMultiplicities(op);

    this.ref.endpoints = [
      {
        ...extractNamesFromRefOperand(leftExpression!, this.container as Table | undefined),
        relation: multiplicities[0],
        token: getTokenPosition(leftExpression!),
      },
      {
        ...extractNamesFromRefOperand(rightExpression!, this.container as Table | undefined),
        relation: multiplicities[1],
        token: getTokenPosition(rightExpression!),
      },
    ];

    this.env.refIds[refId] = this.declarationNode;

    return [];
  }
}
