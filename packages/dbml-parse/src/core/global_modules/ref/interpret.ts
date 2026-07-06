import {
  destructureComplexVariable, extractVariableFromExpression,
  getBody,
} from '@/core/utils/expression';
import { aggregateSettingList } from '@/core/utils/validate';
import { extractStringFromIdentifierStream } from '@/core/utils/expression';
import { CompileError, CompileErrorCode, CompileInfo } from '@/core/types/errors';
import type { SyntaxToken } from '@/core/types/tokens';
import {
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  IdentifierStreamNode,
  ListExpressionNode,
  AttributeNode,
  PrefixExpressionNode,
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
import { addSettingEdit } from '@/compiler/queries/transform/addSetting';
import {
  getMultiplicities, getRelationshipOp, parseCardinality,
  makeCardinalityOptional, makeCardinalityRequired, makeCardinalityMany,
} from '@/core/types/relation';
import type { RelationCardinality } from '@/core/types/relation';
import type { QuickFix } from '@/core/types/errors';
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
    const { hints } = this.validateRefConstraints();
    return Report.create(this.ref as Ref, errors, undefined, hints);
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

  // Validate that column constraints match the ref operator.
  private validateRefConstraints (): { hints: CompileInfo[] } {
    if (!this.metadata.cardinalities(this.compiler)) return { hints: [] };
    return {
      hints: [
        ...this.validateCardinality('right'),
        ...this.validateCardinality('left'),
      ],
    };
  }

  // Extract the operator token from the ref declaration.
  private getOpToken (): SyntaxToken | undefined {
    if (this.declarationNode instanceof ElementDeclarationNode) {
      const field = getBody(this.declarationNode)[0];
      if (!(field instanceof FunctionApplicationNode)) return undefined;
      const infix = field.callee;
      if (!(infix instanceof InfixExpressionNode)) return undefined;
      return infix.op;
    }
    if (this.declarationNode instanceof AttributeNode) {
      const prefix = this.declarationNode.value;
      if (!(prefix instanceof PrefixExpressionNode)) return undefined;
      return prefix.op;
    }
    return undefined;
  }

  // Validate one side of the ref operator against column constraints.
  // A cardinality constrains:
  //   min >= 1 -> otherColumns must be NOT NULL
  //   min = 0  -> otherColumns may be nullable, hint if column is NOT NULL
  //   max = 1  -> ownColumns must be unique/pk
  //
  // For each mismatch, two hints are emitted:
  //   1. On the ref endpoint node (in the Ref declaration)
  //   2. On the column declaration (in the Table)
  private validateCardinality (side: 'left' | 'right'): CompileInfo[] {
    const cardinalities = this.metadata.cardinalities(this.compiler)!;
    const thisRel = side === 'left' ? cardinalities[0] : cardinalities[1];
    const otherRel = side === 'left' ? cardinalities[1] : cardinalities[0];
    const card = parseCardinality(thisRel);

    const otherColumns = side === 'left'
      ? this.metadata.rightColumns(this.compiler)
      : this.metadata.leftColumns(this.compiler);
    const ownColumns = side === 'left'
      ? this.metadata.leftColumns(this.compiler)
      : this.metadata.rightColumns(this.compiler);
    const otherNode = side === 'left'
      ? this.metadata.rightToken()
      : this.metadata.leftToken();
    const ownNode = side === 'left'
      ? this.metadata.leftToken()
      : this.metadata.rightToken();

    const opToken = this.getOpToken();
    const op = this.metadata.op(this.compiler) ?? '?';
    const hints: CompileInfo[] = [];

    // min >= 1: the other side's columns must be NOT NULL.
    if (card.min >= 1) {
      for (const col of otherColumns) {
        if (col.nullable(this.compiler)) {
          const msg = `Column '${col.name}' is nullable but operator '${op}' requires it to be NOT NULL`;
          const fixes = [
            opToken && suggestChangeOp(opToken, makeCardinalityOptional(thisRel), otherRel, side, `Allow '${col.name}' to be optional`),
            suggestAddSetting(col, 'not null'),
          ].filter((f): f is QuickFix => !!f);

          hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, otherNode, { quickFixes: fixes }));
          if (col.declaration) {
            hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, col.declaration, { quickFixes: fixes }));
          }
        }
      }
    }

    // min = 0: the other side may be nullable.
    // Emit a hint if the column is actually NOT NULL.
    if (card.min === 0) {
      for (const col of otherColumns) {
        if (col.nullable(this.compiler) === false) {
          const msg = `Column '${col.name}' is NOT NULL but operator '${op}' allows it to be optional`;
          const fixes = [
            opToken && suggestChangeOp(opToken, makeCardinalityRequired(thisRel), otherRel, side, `Make '${col.name}' required`),
          ].filter((f): f is QuickFix => !!f);

          hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, otherNode, { quickFixes: fixes }));
          if (col.declaration) {
            hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, col.declaration, { quickFixes: fixes }));
          }
        }
      }
    }

    // max = 1: the own side's columns must be unique or primary key.
    if (card.max === 1 && ownColumns.length === 1) {
      const col = ownColumns[0];
      if (!col.unique(this.compiler) && !col.pk(this.compiler)) {
        const msg = `Column '${col.name}' should be unique or primary key for operator '${op}'`;
        const fixes = [
          opToken && suggestChangeOp(opToken, makeCardinalityMany(thisRel), otherRel, side, `Allow '${col.name}' to have many`),
          suggestAddSetting(col, 'unique'),
        ].filter((f): f is QuickFix => !!f);

        hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, ownNode, { quickFixes: fixes }));
        if (col.declaration) {
          hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, col.declaration, { quickFixes: fixes }));
        }
      }
    }

    return hints;
  }
}

// Suggest changing the ref operator to resolve a constraint mismatch.
// Preserves the left/right ordering when computing the new operator.
function suggestChangeOp (
  opToken: SyntaxToken,
  newThisRel: RelationCardinality,
  otherRel: RelationCardinality,
  side: 'left' | 'right',
  description: string,
): QuickFix {
  const newLeft = side === 'left' ? newThisRel : otherRel;
  const newRight = side === 'right' ? newThisRel : otherRel;
  const newOp = getRelationshipOp(newLeft, newRight);

  return {
    title: `${description} (change operator to '${newOp}')`,
    filepath: opToken.filepath,
    edits: [
      { start: opToken.start, end: opToken.end, newText: newOp },
    ],
  };
}

// Suggest adding a setting (e.g. 'not null', 'unique') to a column declaration.
// Merges into existing settings block if present, otherwise appends a new one.
function suggestAddSetting (col: ColumnSymbol, setting: string): QuickFix | undefined {
  if (!col.declaration) return undefined;
  const edit = addSettingEdit(col.declaration, setting);
  if (!edit) return undefined;

  return {
    title: `Mark '${col.name}' as ${setting.toUpperCase()}`,
    filepath: col.declaration.filepath,
    edits: [
      edit,
    ],
  };
}
