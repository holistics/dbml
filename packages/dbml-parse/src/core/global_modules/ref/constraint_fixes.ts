import type Compiler from '@/compiler';
import { CompileErrorCode, CompileInfo } from '@/core/types/errors';
import type { QuickFix } from '@/core/types/errors';
import type { SyntaxToken } from '@/core/types/tokens';
import type { ColumnSymbol } from '@/core/types/symbol';
import type { RelationCardinality } from '@/core/types/relation';
import {
  getRelationshipOp, parseCardinality,
  makeCardinalityOptional, makeCardinalityRequired, makeCardinalityMany,
} from '@/core/types/relation';
import { addSettingEdit } from '@/compiler/queries/transform/addSetting';
import { removeSettingEdit } from '@/compiler/queries/transform/updateSetting';
import type { RefMetadata, PartialRefMetadata } from '@/core/types/symbol/metadata';

// Validate one side of a ref operator against column constraints.
// A cardinality constrains:
//   min >= 1 -> otherColumns must be NOT NULL
//   min = 0  -> otherColumns may be nullable, hint if column is NOT NULL
//   max = 1  -> ownColumns must be unique/pk
//
// For each mismatch, two hints are emitted:
//   1. On the ref endpoint node
//   2. On the column declaration
export function validateCardinality (
  compiler: Compiler,
  meta: RefMetadata | PartialRefMetadata,
  side: 'left' | 'right',
  options?: { allowOtherColFix?: boolean; allowOwnColFix?: boolean },
): CompileInfo[] {
  const { allowOtherColFix = true, allowOwnColFix = true } = options ?? {};
  const opToken = meta.opToken();
  const cardinalities = meta.cardinalities(compiler);
  if (!cardinalities) return [];
  const thisRel = side === 'left' ? cardinalities[0] : cardinalities[1];
  const otherRel = side === 'left' ? cardinalities[1] : cardinalities[0];
  const card = parseCardinality(thisRel);

  const otherColumns = side === 'left'
    ? meta.rightColumns(compiler)
    : meta.leftColumns(compiler);
  const ownColumns = side === 'left'
    ? meta.leftColumns(compiler)
    : meta.rightColumns(compiler);
  const otherNode = side === 'left'
    ? meta.rightToken()
    : meta.leftToken();
  const ownNode = side === 'left'
    ? meta.leftToken()
    : meta.rightToken();

  const op = meta.op(compiler) ?? '?';
  const hints: CompileInfo[] = [];

  if (card.min >= 1) {
    for (const col of otherColumns) {
      if (col.nullable(compiler)) {
        const qname = col.qualifiedName(compiler);
        const msg = `Column '${qname}' is nullable but operator '${op}' requires it to be NOT NULL`;
        const fixes = [
          opToken && suggestChangeOp(opToken, makeCardinalityOptional(thisRel), otherRel, side, `Make '${qname}' optional in the ref`),
          allowOtherColFix && suggestMakeNotNull(col, compiler),
        ].filter((f): f is QuickFix => !!f);

        hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, otherNode, { quickFixes: fixes }));
        if (col.declaration) {
          hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, col.declaration, { quickFixes: fixes }));
        }
      }
    }
  }

  if (card.min === 0) {
    for (const col of otherColumns) {
      if (col.nullable(compiler) === false) {
        const qname = col.qualifiedName(compiler);
        const msg = `Column '${qname}' is NOT NULL but operator '${op}' allows it to be optional`;
        const fixes = [
          opToken && suggestChangeOp(opToken, makeCardinalityRequired(thisRel), otherRel, side, `Make '${qname}' required in the ref`),
          allowOtherColFix && suggestMakeNullable(col, compiler),
        ].filter((f): f is QuickFix => !!f);

        hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, otherNode, { quickFixes: fixes }));
        if (col.declaration) {
          hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, col.declaration, { quickFixes: fixes }));
        }
      }
    }
  }

  // TODO: support composite uniqueness check via table indexes
  if (card.max === 1 && ownColumns.length === 1) {
    const col = ownColumns[0];
    if (!col.unique(compiler) && !col.pk(compiler)) {
      const qname = col.qualifiedName(compiler);
      const msg = `Column '${qname}' should be unique or primary key for operator '${op}'`;
      const fixes = [
        opToken && suggestChangeOp(opToken, makeCardinalityMany(thisRel), otherRel, side, `Make '${qname}' many in the ref`),
        allowOwnColFix && suggestMakeUnique(col, compiler),
      ].filter((f): f is QuickFix => !!f);

      hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, ownNode, { quickFixes: fixes }));
      if (col.declaration) {
        hints.push(new CompileInfo(CompileErrorCode.INVALID_REF_RELATIONSHIP, msg, col.declaration, { quickFixes: fixes }));
      }
    }
  }

  return hints;
}

export function validatePartialRef (compiler: Compiler, meta: PartialRefMetadata): CompileInfo[] {
  return [
    ...validateCardinality(compiler, meta, 'right', { allowOtherColFix: false }),
    ...validateCardinality(compiler, meta, 'left', { allowOwnColFix: false }),
  ];
}

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

function suggestMakeNotNull (col: ColumnSymbol, compiler: Compiler): QuickFix | undefined {
  if (!col.declaration) return undefined;
  if (col.pk(compiler) || col.increment(compiler) || col.isNotNullSet(compiler)) return undefined;

  const source = compiler.getSource(col.declaration.filepath);
  if (!source) return undefined;
  const qname = col.qualifiedName(compiler);

  const removeNull = removeSettingEdit(col.declaration, 'null', source);
  if (removeNull) {
    return { title: `Mark '${qname}' as NOT NULL`,
      filepath: col.declaration.filepath,
      edits: [
        removeNull,
      ] };
  }

  const edit = addSettingEdit(col.declaration, 'not null');
  if (!edit) return undefined;
  return { title: `Mark '${qname}' as NOT NULL`,
    filepath: col.declaration.filepath,
    edits: [
      edit,
    ] };
}

function suggestMakeNullable (col: ColumnSymbol, compiler: Compiler): QuickFix | undefined {
  if (!col.declaration) return undefined;

  const source = compiler.getSource(col.declaration.filepath);
  if (!source) return undefined;

  const edit = removeSettingEdit(col.declaration, 'not null', source);
  if (!edit) return undefined;
  return { title: `Mark '${col.qualifiedName(compiler)}' as NULL`,
    filepath: col.declaration.filepath,
    edits: [
      edit,
    ] };
}

function suggestMakeUnique (col: ColumnSymbol, compiler: Compiler): QuickFix | undefined {
  if (!col.declaration) return undefined;
  if (col.unique(compiler) || col.pk(compiler)) return undefined;

  const edit = addSettingEdit(col.declaration, 'unique');
  if (!edit) return undefined;
  return { title: `Mark '${col.qualifiedName(compiler)}' as UNIQUE`,
    filepath: col.declaration.filepath,
    edits: [
      edit,
    ] };
}
