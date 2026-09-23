import type Compiler from '@/compiler';
import { CompileInfo } from '@/core/types/errors';
import type { QuickFix } from '@/core/types/errors';
import type { SyntaxToken } from '@/core/types/tokens';
import type { SyntaxNode } from '@/core/types/nodes';
import type { ColumnSymbol } from '@/core/types/symbol';
import { TableSymbol, InjectedColumnSymbol } from '@/core/types/symbol/symbols';
import { ElementDeclarationNode } from '@/core/types/nodes';
import { UNHANDLED } from '@/core/types/module';
import type { Index } from '@/core/types/schemaJson';
import type { RelationCardinality } from '@/core/types/relation';
import {
  getRelationshipOp, parseCardinality,
  makeCardinalityOptional, makeCardinalityRequired, makeCardinalityMany,
  CARDINALITY_ONE,
} from '@/core/types/relation';
import { addSettingEdit, removeSettingEdit } from '@/core/utils/setting';
import {
  refNullableMismatch,
  refNotNullMismatch,
  refUniqueMismatch,
  refNonUniqueMismatch,
} from '@/core/utils/diagnostics_reporter';
import type { RefMetadata, PartialRefMetadata } from '@/core/types/symbol/metadata';

// Check consistency between a ref's cardinality and column constraints for one side.
//   - cardinality -> columns: does the operator match the column constraints?
//   - columns -> cardinality: do the column constraints suggest a different operator?
//
// NOTE: Nullability checks only apply when the other side is the "source" (FK) side:
//   - many-to-one / one-to-many: the many side is the source -> < requires the many side to be non-nullable, but doesn't require the one side (a PK can still not be mapped to a source)
//   - one-to-one: the right side is the source (SQL exporter convention)
export function validateCardinality (
  compiler: Compiler,
  meta: RefMetadata | PartialRefMetadata,
  side: 'left' | 'right', // Whether we're validating the left side or the right side
  options?: {
    allowOtherColFix?: boolean; // Whether the other side's columns are fixable
    allowOwnColFix?: boolean; // Whether this side's columns are fixable
  },
): CompileInfo[] {
  const { allowOtherColFix = true, allowOwnColFix = true } = options ?? {};

  const op = meta.op(compiler); // <, <?, etc.
  const opToken = meta.opToken();
  const cardinalities = meta.cardinalities(compiler); // a pair of 0..1, 1, *, etc.
  if (!op || !opToken || !cardinalities) return [];

  const rawOwnCard = side === 'left' ? cardinalities[0] : cardinalities[1];
  const ownCard = parseCardinality(rawOwnCard); // Our side of cardinality, example: < + `left` side = `1`

  const rawOtherCard = side === 'left' ? cardinalities[1] : cardinalities[0];
  const otherCard = parseCardinality(rawOtherCard); // Other side of cardinality, example: < + `right` side = `*`

  const ownColumns = side === 'left'
    ? meta.leftColumns(compiler)
    : meta.rightColumns(compiler);
  const otherColumns = side === 'left'
    ? meta.rightColumns(compiler)
    : meta.leftColumns(compiler);

  const ownNode = side === 'left'
    ? meta.leftToken()
    : meta.rightToken();
  const otherNode = side === 'left'
    ? meta.rightToken()
    : meta.leftToken();

  const infos: CompileInfo[] = [];

  // Push a diagnostic for the node and for each column declaration that differs from the node.
  function pushDiag (
    node: SyntaxNode | SyntaxToken,
    columns: ColumnSymbol[],
    createDiag: (target: SyntaxNode | SyntaxToken) => CompileInfo,
  ) {
    infos.push(createDiag(node));
    for (const col of columns) {
      if (col.declaration && col.declaration !== node) {
        infos.push(createDiag(col.declaration));
      }
    }
  }

  // Determine if the other side is the source (FK) side.
  // Nullability checks on otherColumns only make sense for the source side.
  const otherIsSource = otherCard.max === '*' || (ownCard.max === 1 && otherCard.max === 1 && side === 'left');

  /* Nullability vs cardinality min */

  // card.min >= 1: other (source) columns must not all be nullable.
  // A composite FK is only nullable when ALL columns are nullable.
  if (ownCard.min >= 1 && otherIsSource) {
    const allOtherNullable = otherColumns.length > 0 && otherColumns.every((col) => col.nullable(compiler));
    if (allOtherNullable) {
      const qnames = otherColumns.map((c) => c.qualifiedName(compiler).join('.')).join(', ');
      const fixes = [
        opToken && suggestChangeOp(opToken, makeCardinalityOptional(rawOwnCard), rawOtherCard, side, `Make '${qnames}' optional in the ref`),
        ...(allowOtherColFix ? otherColumns.map((col) => suggestMakeNotNull(col, compiler)).filter((f): f is QuickFix => !!f) : []),
      ].filter((f): f is QuickFix => !!f);

      pushDiag(otherNode, otherColumns, (target) =>
        refNullableMismatch(compiler, target, {
          relOp: op,
          columns: otherColumns,
          refNode: meta.declaration,
          quickFixes: fixes,
        }));
    }
  }

  // card.min === 0: if other (source) columns are all NOT NULL, this side should be required.
  if (ownCard.min === 0 && otherIsSource) {
    const allOtherNotNull = otherColumns.length > 0 && otherColumns.every((col) => col.nullable(compiler) === false);
    if (allOtherNotNull) {
      const qnames = otherColumns.map((c) => c.qualifiedName(compiler).join('.')).join(', ');
      const fixes = [
        opToken && suggestChangeOp(opToken, makeCardinalityRequired(rawOwnCard), rawOtherCard, side, `Make '${qnames}' required in the ref`),
        ...(allowOtherColFix ? otherColumns.map((col) => suggestMakeNullable(col, compiler)).filter((f): f is QuickFix => !!f) : []),
      ].filter((f): f is QuickFix => !!f);

      pushDiag(otherNode, otherColumns, (target) =>
        refNotNullMismatch(compiler, target, {
          relOp: op,
          columns: otherColumns,
          refNode: meta.declaration,
          quickFixes: fixes,
        }));
    }
  }

  /* Uniqueness vs cardinality max */

  // card.max === *: if ownColumns are unique/pk, max should be 1.
  if (ownCard.max === '*' && isColumnsUnique(compiler, ownColumns)) {
    const qnames = ownColumns.map((c) => c.qualifiedName(compiler).join('.')).join(', ');
    const fixes = [
      opToken && suggestChangeOp(opToken, CARDINALITY_ONE, rawOtherCard, side, `Make '${qnames}' one in the ref`),
    ].filter((f): f is QuickFix => !!f);

    pushDiag(ownNode, ownColumns, (target) =>
      refUniqueMismatch(compiler, target, {
        relOp: op,
        columns: ownColumns,
        refNode: meta.declaration,
        quickFixes: fixes,
      }));
  }

  // card.max === 1: ownColumns should be unique/pk.
  if (ownCard.max === 1 && !isColumnsUnique(compiler, ownColumns)) {
    const qnames = ownColumns.map((c) => c.qualifiedName(compiler).join('.')).join(', ');
    const fixes = [
      opToken && suggestChangeOp(opToken, makeCardinalityMany(rawOwnCard), rawOtherCard, side, `Make '${qnames}' many in the ref`),
      allowOwnColFix && ownColumns.length === 1 && suggestMakeUnique(ownColumns[0], compiler),
    ].filter((f): f is QuickFix => !!f);

    pushDiag(ownNode, ownColumns, (target) =>
      refNonUniqueMismatch(compiler, target, {
        relOp: op,
        columns: ownColumns,
        refNode: meta.declaration,
        quickFixes: fixes,
      }));
  }

  return infos;
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
    shortTitle: `Change to ${newOp}`,
    filepath: opToken.filepath,
    edits: [
      { start: opToken.start, end: opToken.end, newText: newOp },
    ],
    isPreferred: true,
  };
}

function suggestMakeNotNull (col: ColumnSymbol, compiler: Compiler): QuickFix | undefined {
  if (!col.declaration) return undefined;
  if (col.pk(compiler) || col.increment(compiler) || col.isNotNullSet(compiler)) return undefined;

  const source = compiler.getSource(col.declaration.filepath);
  if (!source) return undefined;
  const qname = col.qualifiedName(compiler).join('.');

  const removeNull = removeSettingEdit(col.declaration, 'null', source);
  if (removeNull) {
    return { title: `Mark '${qname}' as NOT NULL`,
      shortTitle: 'Add not null',
      filepath: col.declaration.filepath,
      edits: [
        removeNull,
      ] };
  }

  const edit = addSettingEdit(col.declaration, 'not null');
  if (!edit) return undefined;
  return { title: `Mark '${qname}' as NOT NULL`,
    shortTitle: 'Add not null',
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
  return { title: `Mark '${col.qualifiedName(compiler).join('.')}' as NULL`,
    shortTitle: 'Make nullable',
    filepath: col.declaration.filepath,
    edits: [
      edit,
    ] };
}

// Check if a set of columns is covered by a unique or pk constraint.
// Single column: check col.unique() or col.pk().
// Composite: check if any composite unique/pk index on the table matches exactly these columns.
function isColumnsUnique (compiler: Compiler, columns: ColumnSymbol[]): boolean {
  if (columns.length === 0) return false;

  if (columns.length === 1 && columns[0].unique(compiler)) {
    return true;
  }

  // Find the owner table from the first column's declaration
  const col = columns[0];
  const decl = col instanceof InjectedColumnSymbol ? col.injectionDeclaration : col.declaration;
  const tableNode = decl?.parentOfKind(ElementDeclarationNode);
  if (!tableNode) return false;
  const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
  if (!(tableSymbol instanceof TableSymbol)) return false;

  // Get all interpreted indexes from the table
  const indexMetas = tableSymbol.mergedIndexes(compiler);
  const colNames = new Set(columns.map((c) => c.name));

  for (const meta of indexMetas) {
    const result = compiler.interpretMetadata(meta, columns[0].filepath);
    const indexes = result.getValue();
    if (!indexes || !Array.isArray(indexes)) continue;

    for (const idx of indexes as Index[]) {
      if (!idx.unique && !idx.pk) continue;
      if (idx.columns.length !== colNames.size) continue;
      if (idx.columns.every((c) => colNames.has(c.value))) return true;
    }
  }

  return false;
}

function suggestMakeUnique (col: ColumnSymbol, compiler: Compiler): QuickFix | undefined {
  if (!col.declaration) return undefined;
  if (col.isUniqueSet(compiler) || col.pk(compiler)) return undefined;

  const edit = addSettingEdit(col.declaration, 'unique');
  if (!edit) return undefined;
  return { title: `Mark '${col.qualifiedName(compiler).join('.')}' as UNIQUE`,
    shortTitle: 'Add unique',
    filepath: col.declaration.filepath,
    edits: [
      edit,
    ] };
}
