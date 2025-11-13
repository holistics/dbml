import {
  destructureComplexVariable, destructureMemberAccessExpression, extractQuotedStringToken, extractVarNameFromPrimaryVariable,
} from '../../analyzer/utils';
import { aggregateSettingList } from '../../analyzer/validator/utils';
import { CompileError, CompileErrorCode } from '../../errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  ListExpressionNode,
  NormalExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '../../parser/nodes';
import {
  Dep,
  ElementInterpreter, FieldDep, InterpreterDatabase,
} from '../types';
import {
  getTokenPosition, normalizeNoteContent,
} from '../utils';
import { isAccessExpression, isExpressionAVariableNode } from '../../parser/utils';
import { SettingName } from '../../analyzer/types';
import { TableSymbol } from '../../analyzer/symbol/symbols';
import { SymbolKind, destructureIndex } from '../../analyzer/symbol/symbolIndex';

export class DepInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private dep: Partial<Dep>;
  private downstreamTableSymbol: TableSymbol | undefined;
  private upstreamTableSymbols: TableSymbol[];

  constructor (declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.dep = { };
    this.downstreamTableSymbol = undefined;
    this.upstreamTableSymbols = [];
  }

  interpret (): CompileError[] {
    this.dep.token = getTokenPosition(this.declarationNode);
    this.env.deps.set(this.declarationNode, this.dep as Dep);
    const errors = [
      ...this.interpretName(this.declarationNode.name),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as FunctionApplicationNode),
    ];
    return errors;
  }

  private interpretName (nameNode?: SyntaxNode): CompileError[] {
    this.dep.name = destructureComplexVariable(nameNode).unwrapOr(undefined)?.join('.');

    return [];
  }

  private interpretSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (!settingList) return [];
    const settingMap = aggregateSettingList(settingList).getValue();
    const [noteNode] = settingMap[SettingName.Note] || [];
    this.dep.note = noteNode && {
      value: extractQuotedStringToken(noteNode?.value).map(normalizeNoteContent).unwrap(),
      token: getTokenPosition(noteNode),
    };

    return [];
  }

  private interpretBody (body: FunctionApplicationNode): CompileError[] {
    const tableDep = body.callee!;
    const settingList = body.args[0] instanceof ListExpressionNode ? body.args[0] : undefined;
    let fieldDeps: FunctionApplicationNode[] = [];
    if (body.args[0] instanceof BlockExpressionNode) fieldDeps = body.args[0].body.filter((d) => d instanceof FunctionApplicationNode) as FunctionApplicationNode[];
    else if (body.args[1] instanceof BlockExpressionNode) fieldDeps = body.args[1].body.filter((d) => d instanceof FunctionApplicationNode) as FunctionApplicationNode[];

    this.dep.fieldDeps = [];
    const errors = [
      ...this.interpretTableDep(tableDep),
      ...this.interpretSettingList(settingList),
      ...fieldDeps.flatMap((d) => this.interpretFieldDep(d)),
    ];
    if (fieldDeps.length === 0) {
      [...(this.downstreamTableSymbol?.symbolTable.entries() || [])].forEach(([downstreamIndex]) => {
        const { kind: downstreamKind, name: downstreamName } = destructureIndex(downstreamIndex).unwrapOr({ kind: undefined, name: undefined });
        if (downstreamKind !== SymbolKind.Column || downstreamName === undefined) return;
        const fieldDep: FieldDep = { downstreamField: downstreamName, upstreamFields: [] };
        this.upstreamTableSymbols.forEach((symbol, idx) => [...(symbol.symbolTable.entries() || [])].forEach(([upstreamIndex]) => {
          const { kind: upstreamKind, name: upstreamName } = destructureIndex(upstreamIndex).unwrapOr({ kind: undefined, name: undefined });
          if (upstreamKind !== SymbolKind.Column || upstreamName === undefined) return;
          if (downstreamName === upstreamName) {
            fieldDep.upstreamFields.push({ ownerTableIdx: idx, field: upstreamName });
          }
        }));
        this.dep.fieldDeps?.push(fieldDep);
      });
    }
    return errors;
  }

  private interpretTableDep (tableDepNode: ExpressionNode): CompileError[] {
    const errors = [];
    const leftVars = destructureDependencyOperand((tableDepNode as InfixExpressionNode).leftExpression!);
    const leftTableNameNode = leftVars[0].variables.pop();
    this.downstreamTableSymbol = leftTableNameNode!.referee as TableSymbol;
    const leftSchemaNameNode = leftVars[0].variables.pop();
    if (leftVars[0].variables.length) {
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', (tableDepNode as InfixExpressionNode).leftExpression!));
    } else {
      this.dep.downstreamTable = {
        table: extractVarNameFromPrimaryVariable(leftTableNameNode).unwrap(),
        schema: extractVarNameFromPrimaryVariable(leftSchemaNameNode).unwrapOr(undefined),
      };
    }

    this.dep.upstreamTables = [];
    const rightVars = destructureDependencyOperand((tableDepNode as InfixExpressionNode).rightExpression!);
    errors.push(...rightVars.flatMap((vars) => {
      const rightTableNameNode = vars.variables.pop();
      this.upstreamTableSymbols.push(rightTableNameNode!.referee as TableSymbol);
      const rightSchemaNameNode = vars.variables.pop();
      if (vars.variables.length) return [new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', (tableDepNode as InfixExpressionNode).rightExpression!)];
      this.dep.upstreamTables?.push({
        table: extractVarNameFromPrimaryVariable(rightTableNameNode).unwrap(),
        schema: extractVarNameFromPrimaryVariable(rightSchemaNameNode).unwrapOr(undefined),
      });
      return [];
    }));

    return errors;
  }

  private interpretFieldDep (_fieldDepNode: FunctionApplicationNode): CompileError[] {
    if (!Array.isArray(this.dep.fieldDeps)) return [];
    const fieldDepNode = _fieldDepNode.callee as InfixExpressionNode;
    const settingList = _fieldDepNode.args[0] as ListExpressionNode | undefined;

    const fieldDep: Partial<FieldDep> = {};
    const errors = [];

    const leftVars = destructureDependencyOperand((fieldDepNode as InfixExpressionNode).leftExpression!);
    const leftColumnNameNode = leftVars[0].variables.pop();
    const leftColumnName = extractVarNameFromPrimaryVariable(leftColumnNameNode).unwrap();
    const leftTableNameNode = leftVars[0].variables.pop();
    if (leftTableNameNode?.referee !== this.downstreamTableSymbol) {
      errors.push(
        new CompileError(
          CompileErrorCode.FIELD_DEP_NOT_REFERENCING_TABLE_DEP,
          'A downstream field dependency expression should reference a downstream table',
        (fieldDepNode as InfixExpressionNode).leftExpression!,
        ),
      );
    }
    leftVars[0].variables.pop();
    if (leftVars[0].variables.length) {
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', (fieldDepNode as InfixExpressionNode).leftExpression!));
    } else {
      fieldDep.downstreamField = leftColumnName;
    }

    fieldDep.upstreamFields = [];
    const rightVars = destructureDependencyOperand((fieldDepNode as InfixExpressionNode).rightExpression!);
    errors.push(...rightVars.flatMap((vars) => {
      const rightColumnNameNode = vars.variables.pop();
      const rightColumnName = extractVarNameFromPrimaryVariable(rightColumnNameNode).unwrap();
      const rightTableNameNode = vars.variables.pop();
      vars.variables.pop();
      const ownerTableIdx = this.upstreamTableSymbols.findIndex((t) => t === rightTableNameNode?.referee);
      if (ownerTableIdx === -1) {
        return [
          new CompileError(
            CompileErrorCode.FIELD_DEP_NOT_REFERENCING_TABLE_DEP,
            'An upstream field dependency expression should reference an upstream table',
          (fieldDepNode as InfixExpressionNode).rightExpression!,
          ),
        ];
      }
      if (vars.variables.length) return [new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', (fieldDepNode as InfixExpressionNode).rightExpression!)];
      fieldDep.upstreamFields?.push({
        field: rightColumnName,
        ownerTableIdx,
      });
      return [];
    }));

    const settingMap = aggregateSettingList(settingList).getValue();
    const noteNode = settingMap[SettingName.Note]?.at(0);
    fieldDep.note = noteNode && {
      value: extractQuotedStringToken(noteNode.value).map(normalizeNoteContent).unwrap(),
      token: getTokenPosition(noteNode),
    };
    const name = extractQuotedStringToken(settingMap[SettingName.Name]?.at(0)?.value).unwrapOr(undefined);
    fieldDep.name = name;

    this.dep.fieldDeps.push(fieldDep as FieldDep);

    return errors;
  }
}

function destructureDependencyOperand (operand: NormalExpressionNode): { variables: (PrimaryExpressionNode & { expression: VariableNode })[] }[] {
  if (isExpressionAVariableNode(operand)) return [{ variables: [operand] }];
  if (operand instanceof TupleExpressionNode) return operand.elementList.flatMap((e) => destructureDependencyOperand(e));
  if (!isAccessExpression(operand)) throw new Error('Unreachable in destructureDependencyOperand');
  const leftVars = destructureMemberAccessExpression(operand.leftExpression).unwrapOr([]) as (PrimaryExpressionNode & { expression: VariableNode })[];
  const rightVars = destructureDependencyOperand(operand.rightExpression).map((r) => r.variables);
  return rightVars.map((v) => ({ variables: [...leftVars, ...v] }));
}
