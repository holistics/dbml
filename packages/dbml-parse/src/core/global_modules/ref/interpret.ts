import {
  destructureComplexVariable, extractVariableFromExpression,
  getBody,
} from '@/core/utils/expression';
import { aggregateSettingList } from '@/core/utils/validate';
import { extractStringFromIdentifierStream } from '@/core/utils/expression';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  type ListExpressionNode,
  AttributeNode,
} from '@/core/types/nodes';
import type { Ref } from '@/core/types/schemaJson';
import {
  RefMetadata,
  type Filepath,
} from '@/core/types';
import type Compiler from '@/compiler';
import {
  extractColor,
  getTokenPosition,
} from '@/core/utils/interpret';
import Report from '@/core/types/report';
import { getMultiplicities } from '../utils';
import { zip } from 'lodash-es';

export class RefInterpreter {
  private compiler: Compiler;
  private metadata: RefMetadata;
  private declarationNode: ElementDeclarationNode | AttributeNode;
  private filepath: Filepath;
  private ref: Partial<Ref>;

  constructor (compiler: Compiler, metadata: RefMetadata, filepath: Filepath) {
    this.compiler = compiler;
    this.filepath = filepath;
    this.metadata = metadata;
    this.declarationNode = metadata.declaration;
    this.ref = {};
  }

  interpret (): Report<Ref> {
    this.ref.token = getTokenPosition(this.declarationNode);
    const errors = [
      ...this.interpretName(),
      ...this.interpretBody(),
    ];
    return Report.create(this.ref as Ref, errors);
  }

  private interpretName (): CompileError[] {
    // Inline refs do not have a name
    if (!(this.declarationNode instanceof ElementDeclarationNode)) return [];
    const errors: CompileError[] = [];

    const fragments = destructureComplexVariable(this.declarationNode.name!) ?? [];
    this.ref.name = fragments.pop() || null;
    if (fragments.length > 1) {
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', this.declarationNode.name!));
    }
    this.ref.schemaName = fragments.join('.') || null;

    return errors;
  }

  private interpretBody (): CompileError[] {
    const op = this.metadata.op(this.compiler)!;

    const leftColumnSymbols = this.metadata.leftColumns(this.compiler);
    const leftTableSymbol = this.metadata.leftTable(this.compiler);

    const rightColumnSymbols = this.metadata.rightColumns(this.compiler);
    const rightTableSymbol = this.metadata.rightTable(this.compiler);

    if (zip(leftColumnSymbols, rightColumnSymbols).every(([
      left,
      right,
    ]) => left?.originalSymbol === right?.originalSymbol)) {
      return [
        new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', this.declarationNode),
      ];
    }

    const multiplicities = getMultiplicities(op)!;

    const leftTableName = leftTableSymbol?.interpretedName(this.compiler, this.filepath);
    const rightTableName = rightTableSymbol?.interpretedName(this.compiler, this.filepath);

    // Derive tokens for each endpoint via metadata
    const leftToken = getTokenPosition(this.metadata.leftToken());
    const rightToken = getTokenPosition(this.metadata.rightToken());

    // For inline refs: left = container (FK side), right = target (referenced side)
    // We need to swap endpoints to match the standalone FK convention
    this.ref.endpoints = !(this.declarationNode instanceof ElementDeclarationNode)
      ? [
          {
            schemaName: rightTableName?.schema ?? null,
            tableName: rightTableName?.name ?? '',
            fieldNames: rightColumnSymbols.map((c) => c.name ?? ''),
            relation: multiplicities[1],
            token: rightToken,
          },
          {
            schemaName: leftTableName?.schema ?? null,
            tableName: leftTableName?.name ?? '',
            fieldNames: leftColumnSymbols.map((c) => c.name ?? ''),
            relation: multiplicities[0],
            token: leftToken,
          },
        ]
      : [
          {
            schemaName: leftTableName?.schema ?? null,
            tableName: leftTableName?.name ?? '',
            fieldNames: leftColumnSymbols.map((c) => c.name ?? ''),
            relation: multiplicities[0],
            token: leftToken,
          },
          {
            schemaName: rightTableName?.schema ?? null,
            tableName: rightTableName?.name ?? '',
            fieldNames: rightColumnSymbols.map((c) => c.name ?? ''),
            relation: multiplicities[1],
            token: rightToken,
          },
        ];

    // Inline refs have no other settings
    if (!(this.declarationNode instanceof ElementDeclarationNode)) return [];

    const field = getBody(this.declarationNode)[0] as FunctionApplicationNode;

    if (field.args[0]) {
      const settingMap = aggregateSettingList(field.args[0] as ListExpressionNode).getValue();

      const deleteSetting = settingMap.delete?.at(0)?.value;
      this.ref.onDelete = deleteSetting instanceof IdentifierStreamNode
        ? extractStringFromIdentifierStream(deleteSetting)
        : extractVariableFromExpression(deleteSetting) as string;

      const updateSetting = settingMap.update?.at(0)?.value;
      this.ref.onUpdate = updateSetting instanceof IdentifierStreamNode
        ? extractStringFromIdentifierStream(updateSetting)
        : extractVariableFromExpression(updateSetting) as string;

      this.ref.color = settingMap.color?.length ? extractColor(settingMap.color?.at(0)?.value as any) : undefined;
    }

    return [];
  }
}
