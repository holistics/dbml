import {
  destructureComplexVariable, extractVariableFromExpression,
  getBody,
} from '@/core/utils/expression';
import { aggregateSettingList } from '@/core/utils/validate';
import { extractStringFromIdentifierStream } from '@/core/utils/expression';
import { CompileError, CompileErrorCode, CompileInfo } from '@/core/types/errors';
import {
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  type ListExpressionNode,
  AttributeNode,
  SyntaxNode,
} from '@/core/types/nodes';
import type { Ref } from '@/core/types/schemaJson';
import {
  ColumnSymbol,
  RefMetadata,
  type Filepath,
} from '@/core/types';
import type Compiler from '@/compiler';
import {
  extractColor,
  getTokenPosition,
} from '@/core/utils/interpret';
import Report from '@/core/types/report';
import { getMultiplicities } from '@/core/types/relation';
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
    const { infos } = this.validateRefConstraints();
    return Report.create(this.ref as Ref, errors, undefined, infos);
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

      this.ref.inactive = settingMap.inactive?.length ? true : undefined;
    }

    return [];
  }

  private validateRefConstraints (): { infos: CompileInfo[] } {
    const leftCard = this.metadata.leftCardinality(this.compiler);
    const rightCard = this.metadata.rightCardinality(this.compiler);
    if (!leftCard || !rightCard) return { infos: [] };

    const leftColumns = this.metadata.leftColumns(this.compiler);
    const rightColumns = this.metadata.rightColumns(this.compiler);

    const r1 = this.validateCardinalityConstraints(rightCard, leftColumns, rightColumns, this.metadata.leftToken(), this.metadata.rightToken());
    const r2 = this.validateCardinalityConstraints(leftCard, rightColumns, leftColumns, this.metadata.rightToken(), this.metadata.leftToken());

    return {
      infos: [
        ...r1,
        ...r2,
      ],
    };
  }

  // A cardinality constrains:
  //   min >= 1 → otherColumns must be NOT NULL
  //   min = 0  → otherColumns may be nullable; info if NOT NULL (operator is more permissive)
  //   max = 1  → ownColumns must be unique/pk
  private validateCardinalityConstraints (
    cardinality: { min: number; max: number | '*' },
    otherColumns: ColumnSymbol[],
    ownColumns: ColumnSymbol[],
    otherNode: SyntaxNode,
    ownNode: SyntaxNode,
  ): CompileInfo[] {
    const infos: CompileInfo[] = [];

    // min >= 1 -> other side must be NOT NULL
    if (cardinality.min >= 1 && otherColumns.length > 0) {
      for (const col of otherColumns) {
        if (col.nullable(this.compiler) === true) {
          const msg = `Column '${col.name}' is nullable but operator implies mandatory`;
          infos.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, otherNode));
          if (col.declaration) {
            infos.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, col.declaration));
          }
        }
      }
    }

    // min = 0 -> other side may be nullable; info if NOT NULL
    if (cardinality.min === 0 && otherColumns.length > 0) {
      for (const col of otherColumns) {
        if (col.nullable(this.compiler) === false) {
          const msg = `Column '${col.name}' is NOT NULL but operator marks it optional`;
          infos.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, otherNode));
          if (col.declaration) {
            infos.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, col.declaration));
          }
        }
      }
    }

    // max = 1 -> own side must be unique/pk
    if (cardinality.max === 1 && ownColumns.length === 1) {
      const col = ownColumns[0];
      if (!col.unique(this.compiler) && !col.pk(this.compiler)) {
        const msg = `Column '${col.name}' should be unique or primary key for a one-side relationship`;
        infos.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, ownNode));
        if (col.declaration) {
          infos.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, col.declaration));
        }
      }
    }

    return infos;
  }
}
