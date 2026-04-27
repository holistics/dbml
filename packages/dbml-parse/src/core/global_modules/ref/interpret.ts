import Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, IdentiferStreamNode, InfixExpressionNode, ListExpressionNode, SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Ref, RefEndpoint, RelationCardinality, TokenPosition,
} from '@/core/types/schemaJson';
import {
  destructureComplexVariable, extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  extractStringFromIdentifierStream,
} from '@/core/utils/expression';
import {
  aggregateSettingList,
} from '@/core/utils/validate';
import {
  parseColor, getTokenPosition,
} from '@/core/utils/interpret';
import {
  extractNamesFromRefOperand, getMultiplicities,
} from '../utils';

function buildRefEndpoint (
  names: {
    schemaName: string | null;
    tableName: string;
    fieldNames: string[];
  },
  relation: RelationCardinality,
  token: TokenPosition,
): RefEndpoint {
  return {
    schemaName: names.schemaName,
    tableName: names.tableName,
    fieldNames: names.fieldNames,
    relation,
    token,
  };
}

export class RefInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private ref: Partial<Ref>;
  private ownerTable?: string;
  private ownerSchema?: string | null;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
    this.ref = {};
    const parent = this.declarationNode.parent;
    if (parent instanceof ElementDeclarationNode && parent.isKind(ElementKind.Table)) {
      const segments = compiler.nodeFullname(parent).getFiltered(UNHANDLED);
      if (segments && segments.length > 0) {
        const tableName = segments[segments.length - 1];
        const schemaName = segments.length > 1 ? segments.slice(0, -1).join('.') : null;
        this.ownerTable = tableName;
        this.ownerSchema = schemaName;
      }
    }
  }

  interpret (): Report<Ref> {
    this.ref.token = getTokenPosition(this.declarationNode);
    const errors = [
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretBody(this.declarationNode.body!),
    ];
    return new Report(this.ref as Ref, errors);
  }

  private interpretName (_nameNode: SyntaxNode): CompileError[] {
    const errors: CompileError[] = [];

    const fragments = destructureComplexVariable(this.declarationNode.name!) ?? [];
    this.ref.name = fragments.pop() || null;
    if (fragments.length > 1) {
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', this.declarationNode.name!));
    }
    this.ref.schemaName = fragments.join('.') || null;

    return errors;
  }

  private interpretBody (body: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (body instanceof FunctionApplicationNode) {
      return this.interpretField(body);
    }

    return this.interpretField(body.body[0] as FunctionApplicationNode);
  }

  private interpretField (field: FunctionApplicationNode): CompileError[] {
    const op = (field.callee as InfixExpressionNode).op!.value;
    const {
      leftExpression, rightExpression,
    } = field.callee as InfixExpressionNode;

    if (field.args[0]) {
      const settingMap = aggregateSettingList(field.args[0] as ListExpressionNode).getValue();

      const deleteSetting = settingMap.delete?.at(0)?.value;
      this.ref.onDelete = deleteSetting instanceof IdentiferStreamNode
        ? extractStringFromIdentifierStream(deleteSetting) ?? undefined
        : extractVariableFromExpression(deleteSetting) ?? undefined;

      const updateSetting = settingMap.update?.at(0)?.value;
      this.ref.onUpdate = updateSetting instanceof IdentiferStreamNode
        ? extractStringFromIdentifierStream(updateSetting) ?? undefined
        : extractVariableFromExpression(updateSetting) ?? undefined;

      this.ref.color = settingMap.color?.length ? parseColor(settingMap.color?.at(0)?.value as any) : undefined;
    }

    const multiplicities = getMultiplicities(op);
    if (!multiplicities) return [];

    const leftNames = extractNamesFromRefOperand(leftExpression!, this.ownerSchema, this.ownerTable);
    const rightNames = extractNamesFromRefOperand(rightExpression!, this.ownerSchema, this.ownerTable);
    this.ref.endpoints = [
      buildRefEndpoint(leftNames, multiplicities[0], getTokenPosition(leftExpression!)),
      buildRefEndpoint(rightNames, multiplicities[1], getTokenPosition(rightExpression!)),
    ];

    return [];
  }
}
